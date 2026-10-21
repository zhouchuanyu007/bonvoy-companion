"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profileDir = path.join(root, "build", "research", "marriott-api-profile");
const port = 9342;

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
    this.scripts = new Map();
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
        return;
      }
      if (
        message.method === "Debugger.scriptParsed" &&
        message.params.url &&
        message.params.url.startsWith("https://www.marriott.com.cn/")
      ) {
        this.scripts.set(message.params.scriptId, message.params.url);
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
}

(async () => {
  let cdp;
  try {
    const page = await getTarget();
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Debugger.enable");
    await cdp.send("Page.enable");
    await cdp.send("Page.navigate", {
      url: "https://www.marriott.com.cn/search/default.mi"
    });
    await sleep(9000);

    const needles = [
      "phoenixShop",
      "hotelSearch",
      "hotel-search",
      "findHotels",
      "availabilitySearch",
      "graphql",
      "properties",
      "resorts"
    ];
    const findings = new Map();
    for (const [scriptId, url] of cdp.scripts.entries()) {
      try {
        const result = await cdp.send("Debugger.getScriptSource", { scriptId });
        const source = result.scriptSource || "";
        for (const needle of needles) {
          let index = source.indexOf(needle);
          let matches = 0;
          while (index >= 0 && matches < 5) {
            const snippet = source.slice(Math.max(0, index - 220), index + 420);
            const key = url + "::" + needle + "::" + snippet.slice(0, 120);
            findings.set(key, {
              url,
              needle,
              snippet
            });
            index = source.indexOf(needle, index + needle.length);
            matches += 1;
          }
        }
      } catch (error) {
        // Some scripts are evicted from the debugger cache.
      }
    }

    console.log(
      JSON.stringify(
        {
          scriptCount: cdp.scripts.size,
          findings: Array.from(findings.values())
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
