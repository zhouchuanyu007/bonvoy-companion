"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profileDir = path.join(root, "build", "research", "marriott-sync-profile");
const port = 9344;

if (!profileDir.startsWith(path.join(root, "build", "research") + path.sep)) {
  throw new Error("Refusing to clear profile outside the research directory");
}
fs.mkdirSync(path.dirname(profileDir), { recursive: true });
fs.rmSync(profileDir, { recursive: true, force: true });

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "about:blank"
  ],
  { stdio: "ignore", windowsHide: true }
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getTarget() {
  for (let index = 0; index < 60; index += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const page = (await response.json()).find((item) => item.type === "page");
      if (page) return page;
    } catch (error) {
      // Chrome is still starting.
    }
    await sleep(250);
  }
  throw new Error("Chrome did not start");
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 1;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        message.error
          ? pending.reject(new Error(message.error.message))
          : pending.resolve(message.result);
      }
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, awaitPromise) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: Boolean(awaitPromise),
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text);
    }
    return result.result ? result.result.value : undefined;
  }
}

(async () => {
  let cdp;
  try {
    const page = await getTarget();
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Page.navigate", {
      url: "https://www.marriott.com.cn/search/default.mi"
    });
    await sleep(7000);

    await cdp.evaluate(
      "window.__syncResult=null;window.__syncError=null;window.LvbanSyncBridge={onComplete:p=>window.__syncResult=p,onError:e=>window.__syncError=e};"
    );
    const asset = fs.readFileSync(
      path.join(root, "app", "assets", "sync", "marriott-sync.js"),
      "utf8"
    );
    await cdp.evaluate(asset);
    await cdp.evaluate(
      "window.__lvbanOfficialSync({destinationId:'nanjing',cityName:'南京',latitude:32.0603,longitude:118.7969,checkIn:'2026-10-20',checkOut:'2026-10-21'});"
    );

    let result = null;
    let error = null;
    for (let index = 0; index < 45; index += 1) {
      await sleep(1000);
      const status = await cdp.evaluate(
        "({result:window.__syncResult||null,error:window.__syncError||null})"
      );
      if (status.error) {
        error = status.error;
        break;
      }
      if (status.result) {
        result = JSON.parse(status.result);
        break;
      }
    }
    if (error) throw new Error(error);
    if (!result) throw new Error("Live sync timed out");
    const priced = result.hotels.filter((hotel) => Number(hotel.price) > 0);
    const pointsPriced = result.hotels.filter(
      (hotel) => Number(hotel.pointsPrice) > 0
    );
    console.log(
      JSON.stringify(
        {
          destinationId: result.destinationId,
          cityName: result.cityName,
          checkIn: result.checkIn,
          checkOut: result.checkOut,
          total: result.total,
          hotels: result.hotels.length,
          priced: priced.length,
          pointsPriced: pointsPriced.length,
          sample: priced.slice(0, 5).map((hotel) => ({
            id: hotel.id,
            name: hotel.name,
            price: hotel.price,
            pointsPrice: hotel.pointsPrice,
            rating: hotel.rating
          }))
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error(error.stack || error);
    process.exitCode = 1;
  } finally {
    if (cdp) cdp.ws.close();
    chrome.kill();
  }
})();
