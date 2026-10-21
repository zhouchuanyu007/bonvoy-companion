"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profileDir = path.join(root, "build", "research", "amap-profile");
const port = 9347;

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
    this.console = [];
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
      if (message.method === "Runtime.consoleAPICalled") {
        this.console.push(
          message.params.args.map((arg) => arg.value || arg.description).join(" ")
        );
      }
      if (message.method === "Runtime.exceptionThrown") {
        this.console.push("EXCEPTION " + message.params.exceptionDetails.text);
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

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
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
    const results = [];
    for (const file of [
      "amap-v1-test.html",
      "amap-v2-test.html",
      "amap-services-test.html",
      "amap-rest-cors-test.html"
    ]) {
      cdp.console.length = 0;
      await cdp.send("Page.navigate", {
        url: pathToFileURL(path.join(root, "tests", file)).toString()
      });
      await sleep(file.includes("services") ? 15000 : 7000);
      const state = await cdp.evaluate(
        "({status:window.__amapStatus,error:window.__amapError,hasAmap:Boolean(window.AMap),plugins:{geocoder:Boolean(window.AMap&&AMap.Geocoder),placeSearch:Boolean(window.AMap&&AMap.PlaceSearch),driving:Boolean(window.AMap&&AMap.Driving)},mapCanvas:document.querySelectorAll('canvas').length,mapNodes:document.querySelectorAll('.amap-maps').length,serviceResult:window.__serviceResult,serviceError:window.__serviceError,restResult:window.__restResult,restError:window.__restError,text:document.body.innerText.slice(0,500)})"
      );
      results.push({ file, state, console: cdp.console.slice(0, 20) });
    }
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error(error.stack || error);
    process.exitCode = 1;
  } finally {
    if (cdp) cdp.ws.close();
    chrome.kill();
  }
})();
