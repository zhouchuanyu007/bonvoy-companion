"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profileDir = path.join(root, "build", "research", "marriott-profile");
const port = 9341;

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
    "--no-default-browser-check",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "about:blank"
  ],
  { stdio: "ignore", windowsHide: true }
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function target() {
  for (let index = 0; index < 60; index += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await response.json();
      const page = list.find((item) => item.type === "page");
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
    this.requests = [];
    this.targetRequests = new Map();
    this.finishedRequests = new Set();
    this.errors = [];
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
      if (message.method === "Network.requestWillBeSent") {
        const request = message.params.request;
        if (
          /\/mi\/query\/|\/aries-search\/|\/availabilitySearch|\/findHotels|\/graphql|\/phoenix-/i.test(
            request.url
          )
        ) {
          this.requests.push({
            requestId: message.params.requestId,
            method: request.method,
            url: request.url,
            headers: request.headers || {},
            postData: request.postData || null
          });
          this.targetRequests.set(message.params.requestId, request.url);
        }
      }
      if (message.method === "Network.loadingFinished") {
        this.finishedRequests.add(message.params.requestId);
      }
      if (message.method === "Runtime.exceptionThrown") {
        this.errors.push(message.params.exceptionDetails.text);
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
    const page = await target();
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Network.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Network.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await cdp.send("Page.navigate", {
      url: "https://www.marriott.com.cn/search/default.mi"
    });
    await sleep(8000);
    const initial = await cdp.evaluate(
      "(()=>({title:document.title,url:location.href,inputs:Array.from(document.querySelectorAll('input')).slice(0,30).map(x=>({id:x.id,name:x.name,placeholder:x.placeholder,aria:x.getAttribute('aria-label'),type:x.type,value:x.value})),buttons:Array.from(document.querySelectorAll('button')).slice(0,30).map(x=>x.innerText.trim()).filter(Boolean),text:document.body.innerText.slice(0,3000)}))()"
    );
    await cdp.evaluate(
      "(()=>{const input=document.querySelector('#downshift-0-input');input.focus();return Boolean(input)})()"
    );
    await cdp.send("Input.insertText", { text: "南京" });
    await sleep(2500);
    const suggestions = await cdp.evaluate(
      "(()=>({text:document.body.innerText.slice(0,2600),options:Array.from(document.querySelectorAll('[role=option],li')).map(x=>x.innerText.trim()).filter(Boolean).slice(0,25)}))()"
    );
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "ArrowDown",
      code: "ArrowDown",
      windowsVirtualKeyCode: 40
    });
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13
    });
    await sleep(1200);
    const clicked = await cdp.evaluate(
      "(()=>{const buttons=Array.from(document.querySelectorAll('button'));const button=buttons.find(x=>x.innerText.trim()==='查找酒店'&&x.offsetParent!==null);if(button){button.click();return {clicked:true,text:button.innerText}}return {clicked:false,text:document.body.innerText.slice(0,1000)}})()"
    );
    await sleep(9000);
    const responseBodies = {};
    for (const request of cdp.requests) {
      if (!cdp.finishedRequests.has(request.requestId)) continue;
      try {
        const body = await cdp.send("Network.getResponseBody", {
          requestId: request.requestId
        });
        responseBodies[request.requestId] = body.body;
      } catch (error) {
        responseBodies[request.requestId] = "ERROR: " + error.message;
      }
    }
    const reportPath = path.join(
      root,
      "build",
      "research",
      "marriott-search-network.json"
    );
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ requests: cdp.requests, responseBodies }, null, 2)
    );
    const results = await cdp.evaluate(
      "(()=>({url:location.href,text:document.body.innerText.slice(0,3500),cards:document.querySelectorAll('[data-testid*=hotel], .hotel-card, article').length}))()"
    );
    console.log(
      JSON.stringify(
        {
          initial,
          suggestions,
          clicked,
          results,
          requests: cdp.requests,
          responseBodyKeys: Object.keys(responseBodies),
          reportPath,
          errors: cdp.errors
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
