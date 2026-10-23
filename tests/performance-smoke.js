"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profileDir = path.join(root, "build", "performance-profile");
const port = 9334;
const pageUrl = "http://127.0.0.1:4173/index.html?performance=1";

if (!profileDir.startsWith(path.join(root, "build") + path.sep)) {
  throw new Error("Refusing to clear browser profile outside the build directory");
}
fs.rmSync(profileDir, { recursive: true, force: true });
fs.mkdirSync(profileDir, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTarget() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page");
        if (page) return page;
      }
    } catch (error) {
      // Chrome is still starting.
    }
    await sleep(100);
  }
  throw new Error("Chrome DevTools endpoint did not start");
}

async function waitForApp(client, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await client.evaluate(
      "({ready:document.readyState,hasMain:Boolean(document.querySelector('#app-main')),text:document.body?.innerText?.slice(0,80) || ''})"
    );
    if (state.hasMain && state.text) return state;
    await sleep(250);
  }
  throw new Error("App did not render within " + timeoutMs + "ms");
}

async function waitForCondition(client, expression, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await client.evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error("Condition did not become true within " + timeoutMs + "ms: " + expression);
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text ||
          "Evaluation failed"
      );
    }
    return result.result ? result.result.value : undefined;
  }

  close() {
    this.socket.close();
  }
}

(async () => {
  let chrome;
  let client;
  try {
    chrome = spawn(
      chromePath,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--remote-allow-origins=*",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profileDir}`,
        "about:blank"
      ],
      { stdio: "ignore", windowsHide: true }
    );
    const target = await waitForTarget();
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    await client.send("Performance.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true
    });
    await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 120,
      downloadThroughput: 1.5 * 1024 * 1024 / 8,
      uploadThroughput: 750 * 1024 / 8
    });
    await client.send("Page.navigate", { url: pageUrl });
    await waitForApp(client);
    await client.evaluate("localStorage.setItem('lvban.onboarding.v1', 'true'); location.reload()");
    await waitForApp(client);
    await waitForCondition(client, "Boolean(document.querySelector('#app-main') && document.querySelector('#bottom-nav [data-nav=directory]'))");
    const home = await client.evaluate(`(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const resources = performance.getEntriesByType("resource").map((entry) => ({
        name: entry.name,
        duration: Math.round(entry.duration),
        transferSize: entry.transferSize,
        decodedBodySize: entry.decodedBodySize
      }));
      return {
        timing: {
          domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
          loadEvent: Math.round(nav.loadEventEnd),
          responseEnd: Math.round(nav.responseEnd),
          duration: Math.round(nav.duration)
        },
        resources,
        domNodes: document.getElementsByTagName("*").length,
        images: document.images.length,
        route: document.querySelector("#app-main")?.dataset.route || null
      };
    })()`);

    const directoryStart = Date.now();
    await client.evaluate("(() => { const target = document.querySelector('[data-nav=directory]'); if (!target) throw new Error('directory nav missing: ' + document.body.innerText.slice(0, 240)); target.click(); })()");
    await sleep(1200);
    const directory = await client.evaluate(`(() => ({
      route: document.querySelector("#app-main")?.dataset.route || null,
      cards: document.querySelectorAll(".directory-entry").length,
      images: document.querySelectorAll(".directory-entry img").length,
      lazyImages: document.querySelectorAll('.directory-entry img[loading="lazy"]').length,
      asyncImages: document.querySelectorAll('.directory-entry img[decoding="async"]').length,
      domNodes: document.getElementsByTagName("*").length,
      scrollHeight: document.documentElement.scrollHeight,
      resources: performance.getEntriesByType("resource")
        .filter((entry) => entry.name.includes("hotel-insights.js"))
        .map((entry) => ({ name: entry.name, duration: Math.round(entry.duration), transferSize: entry.transferSize }))
    }))()`);
    const directoryElapsed = Date.now() - directoryStart;

    const horizontalLayout = await client.evaluate(`(() => ({
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }))()`);
    const directoryBeforeScroll = await client.evaluate(`(() => ({
      scrollY: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      firstCardTop: document.querySelector('.directory-entry')?.getBoundingClientRect().top || null,
      lastCardTop: document.querySelectorAll('.directory-entry')[23]?.getBoundingClientRect().top || null
    }))()`);
    await client.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)");
    await sleep(250);
    const directoryAfterScroll = await client.evaluate(`(() => ({
      scrollY: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      lastCardTop: document.querySelectorAll('.directory-entry')[23]?.getBoundingClientRect().top || null,
      cardHeights: Array.from(document.querySelectorAll('.directory-entry')).map((card) => Math.round(card.getBoundingClientRect().height))
    }))()`);
    const scrollHeightGrowth = directoryAfterScroll.scrollHeight - directoryBeforeScroll.scrollHeight;
    if (Math.abs(scrollHeightGrowth) > 240) {
      throw new Error(
        `Directory scroll height changed by ${scrollHeightGrowth}px after cards were revealed; ` +
          `before=${directoryBeforeScroll.scrollHeight}, after=${directoryAfterScroll.scrollHeight}, ` +
          `lastTopBefore=${directoryBeforeScroll.lastCardTop}, lastTopAfter=${directoryAfterScroll.lastCardTop}, ` +
          `heights=${directoryAfterScroll.cardHeights.join(",")}`
      );
    }

    const filterStart = Date.now();
    await client.evaluate(`(() => {
      const input = document.querySelector('#directory-query-input');
      if (!input) throw new Error('directory query input missing');
      input.value = '上海';
      document.querySelector('#directory-search-form').requestSubmit();
    })()`);
    await sleep(500);
    const filter = await client.evaluate(`(() => ({
      route: document.querySelector('#app-main')?.dataset.route || null,
      cards: document.querySelectorAll('.directory-entry').length,
      query: document.querySelector('#directory-query-input')?.value || '',
      domNodes: document.getElementsByTagName('*').length
    }))()`);
    const filterElapsed = Date.now() - filterStart;

    const favoriteStart = Date.now();
    await client.evaluate(`(() => {
      const button = document.querySelector('.directory-entry [data-action="toggle-favorite"]');
      if (!button) throw new Error('favorite button missing');
      button.click();
    })()`);
    await sleep(250);
    const favorite = await client.evaluate(`(() => ({
      route: document.querySelector('#app-main')?.dataset.route || null,
      favoriteButtons: Array.from(document.querySelectorAll('[data-action="toggle-favorite"]')).filter((button) => button.textContent.includes('已收藏')).length
    }))()`);
    const favoriteElapsed = Date.now() - favoriteStart;

    await client.evaluate(`(() => {
      const button = document.querySelector('.directory-entry [data-action="view-hotel"]');
      if (!button) throw new Error('hotel detail button missing');
      button.click();
    })()`);
    await waitForCondition(client, "document.querySelector('#app-main')?.dataset.route === 'hotel'");
    await sleep(300);
    const detail = await client.evaluate(`(() => ({
      route: document.querySelector('#app-main')?.dataset.route || null,
      detailTitle: document.querySelector('.hotel-detail-hero h1')?.textContent || '',
      insightSections: document.querySelectorAll('.detail-section').length,
      insightAction: Boolean(document.querySelector('[data-action="load-hotel-insight"]')),
      insightScriptRequests: performance.getEntriesByType('resource')
        .filter((entry) => entry.name.includes('hotel-insights.js'))
        .map((entry) => ({ name: entry.name, duration: Math.round(entry.duration), transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize })),
      insightScriptTags: Array.from(document.scripts)
        .filter((script) => script.src.includes('hotel-insights.js'))
        .map((script) => script.src)
    }))()`);
    await client.evaluate(`(() => {
      const button = document.querySelector('[data-action="load-hotel-insight"]');
      if (!button) throw new Error('hotel insight action missing');
      button.click();
    })()`);
    await sleep(250);
    const insightAction = await client.evaluate(`(() => ({
      insightScriptRequests: performance.getEntriesByType('resource')
        .filter((entry) => entry.name.includes('hotel-insights.js'))
        .map((entry) => entry.name),
      toast: document.querySelector('#toast')?.textContent || ''
    }))()`);

    const rankingStart = Date.now();
    await client.evaluate("document.querySelector('[data-nav=rankings]').click()");
    await sleep(500);
    await client.evaluate("document.querySelector('[data-action=set-rank-mode][data-id=value]')?.click()");
    await sleep(350);
    const rankings = await client.evaluate(`(() => ({
      route: document.querySelector('#app-main')?.dataset.route || null,
      rows: document.querySelectorAll('.ranking-row, [data-action="view-hotel"]').length,
      domNodes: document.getElementsByTagName('*').length
    }))()`);
    const rankingElapsed = Date.now() - rankingStart;

    console.log(JSON.stringify({
      home,
      directory,
      directoryElapsed,
      horizontalLayout,
      directoryBeforeScroll,
      directoryAfterScroll,
      filter,
      filterElapsed,
      favorite,
      favoriteElapsed,
      detail,
      insightAction,
      rankings,
      rankingElapsed
    }, null, 2));
  } finally {
    if (client) client.close();
    if (chrome) chrome.kill();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
