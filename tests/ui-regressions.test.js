"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const www = path.join(__dirname, "..", "app", "assets", "www");

test("hotel insight bundle is deferred until a hotel detail is opened", () => {
  const html = fs.readFileSync(path.join(www, "index.html"), "utf8");
  const source = fs.readFileSync(path.join(www, "app.js"), "utf8");
  assert.doesNotMatch(html, /<script[^>]+src=["']hotel-insights\.js/);
  assert.match(source, /loadHotelInsightsBundle/);
  assert.doesNotMatch(source, /if \(state\.route === "hotel" && !hotelInsightsBundleReady\)/);
});

test("directory photos opt into asynchronous decoding", () => {
  const source = fs.readFileSync(path.join(www, "app.js"), "utf8");
  assert.match(source, /data-hotel-photo[^>]+decoding=["']async["']/);
  assert.match(source, /data-hotel-photo[^>]+fetchpriority=["']low["']/);
});

test("home hero photo emits one high fetch priority attribute", () => {
  const source = fs.readFileSync(path.join(www, "app.js"), "utf8");
  const heroSource = source.slice(source.indexOf("function renderHome()"), source.indexOf("function renderDestination()"));
  assert.equal((heroSource.match(/fetchpriority=["']high["']/g) || []).length, 1);
});

test("offscreen directory cards can skip layout and paint work", () => {
  const style = fs.readFileSync(path.join(www, "style.css"), "utf8");
  assert.match(style, /\.directory-entry\s*\{[^}]*content-visibility:\s*auto/s);
  assert.match(style, /\.directory-entry\s*\{[^}]*contain-intrinsic-size:\s*[^;}]+/s);
});

test("mobile directory cards reserve their real multi-line height", () => {
  const style = fs.readFileSync(path.join(www, "style.css"), "utf8");
  assert.match(
    style,
    /@media\s*\(max-width:\s*600px\)[\s\S]*?\.directory-entry\s*\{[\s\S]*?contain-intrinsic-size:\s*0\s+444px/
  );
});

// Execute the real renderers and delegated handlers without network or native bridges.
function boot({ emptyCatalog = false, storage = {}, flyAiScript = "" } = {}) {
  const elements = new Map();
  for (const id of ["app-main", "app-header", "bottom-nav", "sheet", "sheet-backdrop", "toast"]) {
    elements.set(id, {
      innerHTML: "", dataset: {}, hidden: true,
      classList: { add() {}, remove() {} }, addEventListener() {}
    });
  }
  const listeners = {};
  const windowListeners = {};
  const storedValues = new Map(Object.entries(storage));
  const entries = [];
  let current = -1;
  const history = {
    replaceState(payload) {
      if (current < 0) current = 0;
      entries[current] = structuredClone(payload);
    },
    pushState(payload) {
      entries.splice(++current);
      entries.push(structuredClone(payload));
    },
    back() {
      if (current > 0) windowListeners.popstate({ state: entries[--current] });
    }
  };
  const sandbox = {
    console, URL, history,
    document: {
      body: { style: {} },
      getElementById: (id) => elements.get(id) || null,
      addEventListener: (event, handler) => { listeners[event] = handler; }
    },
    localStorage: {
      getItem: (key) => (storedValues.has(key) ? storedValues.get(key) : null),
      setItem: (key, value) => storedValues.set(key, String(value))
    },
    addEventListener: (event, handler) => { windowListeners[event] = handler; },
    setTimeout() {}, clearTimeout() {}, scrollTo() {}, scrollY: 0
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  for (const file of ["catalog.js", "hotel-prices.js", "app-data.js", "logic.js"]) {
    if (emptyCatalog && file === "catalog.js") continue;
    vm.runInContext(fs.readFileSync(path.join(www, file), "utf8"), context, { filename: file });
  }
  if (flyAiScript) {
    vm.runInContext(flyAiScript, context, { filename: "test-bridges.js" });
  }
  vm.runInContext(fs.readFileSync(path.join(www, "app.js"), "utf8"), context, { filename: "app.js" });
  return {
    elements, history, listeners,
    sandbox,
    storage: storedValues,
    html: () => elements.get("app-main").innerHTML,
    snapshot: () => entries[current],
    click(dataset) {
      listeners.click({ target: { closest: (selector) =>
        (selector === "[data-nav]" && dataset.nav) ||
        (selector === "[data-action]" && dataset.action) ? { dataset } : null
      } });
    },
    search(query) {
      elements.set("home-directory-query", { value: query });
      listeners.submit({ target: { id: "home-directory-search" }, preventDefault() {} });
    },
    destination(name) {
      return sandbox.APP_DATA.destinations.find((item) => item.name === name);
    }
  };
}

test("empty catalog still renders a usable homepage", () => {
  const app = boot({ emptyCatalog: true });
  assert.match(app.html(), /home-directory-search/);
  assert.doesNotMatch(app.html(), /data-action="view-hotel"/);
});

test("browser Back restores each directory query and its filters", () => {
  const app = boot();
  app.search("上海");
  app.listeners.change({ target: { id: "directory-region", value: "华东" } });
  app.listeners.change({ target: { id: "directory-brand", value: "丽思卡尔顿" } });
  app.click({ action: "load-more-directory" });
  app.click({ nav: "home" });
  app.search("杭州");
  app.history.back();
  app.history.back();
  assert.equal(app.snapshot().directoryQuery, "上海");
  assert.equal(app.snapshot().directoryRegion, "华东");
  assert.equal(app.snapshot().directoryBrand, "丽思卡尔顿");
  assert.equal(app.snapshot().directoryLimit, 54);
  assert.match(app.html(), /value="上海"/);
  assert.match(app.html(), /上海浦东丽思卡尔顿酒店/);
  assert.doesNotMatch(app.html(), /杭州/);
});

test("brand placeholder photos are not presented as property photographs", () => {
  const app = boot();
  for (const name of ["九寨沟万怡酒店", "银川兴庆福朋喜来登酒店", "上海外滩北喜来登酒店"]) {
    app.search(name);
    assert.match(app.html(), /image-unavailable/);
    assert.doesNotMatch(app.html(), /<img data-hotel-photo/);
  }
  app.search("上海浦东丽思卡尔顿酒店");
  assert.match(app.html(), /<img data-hotel-photo/);
});

test("failed property photos show the unavailable state", () => {
  const app = boot();
  let fallback = "";
  const image = {
    hidden: false, matches: () => true,
    parentElement: { classList: { add(value) { fallback = value; } } }
  };
  app.listeners.error({ target: image });
  assert.equal(image.hidden, true);
  assert.equal(fallback, "image-unavailable");
});

test("check-in confirmation feature is not present", () => {
  const source = fs.readFileSync(path.join(www, "app.js"), "utf8");
  assert.doesNotMatch(source, /入住前确认|CHECKLIST_ITEMS|focus-checklist/);
});

test("city points promotion result is validated and reused from cache", async () => {
  const app = boot({
    flyAiScript: `
      window.__promotionRequests = 0;
      window.AndroidFlyAi = {
        request(requestId, tool, argumentsJson) {
          window.__promotionRequests += 1;
          const args = JSON.parse(argumentsJson);
          const destination = APP_DATA.destinations.find((item) => item.name === "上海");
          const hotel = APP_DATA.hotels.find((item) =>
            item.destinationId === destination.id &&
            (!item.openingDate || item.openingDate <= new Date().toISOString().slice(0, 10))
          );
          window.__promotionTool = tool;
          window.__promotionHotel = hotel.name;
          window.__promotionHotelId = hotel.id;
          const data = JSON.stringify({
            promotions: [{
              hotelName: hotel.name,
              bonusPoints: 3000,
              validFrom: "2026-10-01",
              validTo: "2027-12-31",
              sourceText: "活动明确标注：入住后额外赠送 3000 万豪积分。",
              sourceUrl: "https://example.com/marriott-points"
            }]
          });
          Promise.resolve().then(() => {
            window.onNativeFlyAiResult(
              requestId,
              JSON.stringify({ status: 0, message: "success", data })
            );
          });
        }
      };
    `
  });
  const destination = app.destination("上海");
  app.click({ nav: "map" });
  app.click({ action: "sync-points-promotions", id: destination.id });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.sandbox.__promotionRequests, 1);
  assert.equal(app.sandbox.__promotionTool, "fliggy_ai_search");
  app.click({
    action: "select-map-hotel",
    id: app.sandbox.__promotionHotelId
  });
  assert.match(app.html(), /积分闪促：额外赠 3,000 分/);
  const cache = [...app.storage.entries()].find(([key]) =>
    key === "lvban.flyPointsPromotionCache.v1"
  );
  assert.ok(cache);
  assert.match(cache[1], /"count":1/);
  app.click({ action: "sync-points-promotions", id: destination.id });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.sandbox.__promotionRequests, 1);
});

test("ordinary points and unknown hotels are not mislabeled as bonus promotions", async () => {
  const app = boot({
    flyAiScript: `
      window.__promotionRequests = 0;
      window.AndroidFlyAi = {
        request(requestId, tool, argumentsJson) {
          window.__promotionRequests += 1;
          const destination = APP_DATA.destinations.find((item) => item.name === "上海");
          const hotel = APP_DATA.hotels.find((item) => item.destinationId === destination.id);
          const data = JSON.stringify({
            promotions: [
              {
                hotelName: hotel.name,
                bonusPoints: 1000,
                sourceText: "万豪会员入住可获得基础积分。"
              },
              {
                hotelName: "不存在的酒店",
                bonusPoints: 3000,
                validTo: "2027-12-31",
                sourceText: "活动额外赠送 3000 积分。"
              }
            ]
          });
          Promise.resolve().then(() => {
            window.onNativeFlyAiResult(
              requestId,
              JSON.stringify({ status: 0, data })
            );
          });
        }
      };
    `
  });
  const destination = app.destination("上海");
  app.click({ nav: "map" });
  app.click({ action: "sync-points-promotions", id: destination.id });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.sandbox.__promotionRequests, 1);
  assert.doesNotMatch(app.html(), /积分闪促：额外赠/);
  assert.match(app.html(), /暂未返回可核验的额外积分活动/);
  app.click({ action: "sync-points-promotions", id: destination.id });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.sandbox.__promotionRequests, 1);
});

test("future hotels are labeled and never sent to FlyAI pricing", async () => {
  const app = boot({
    flyAiScript: `
      window.__hotelPriceRequests = 0;
      window.AndroidFlyAi = {
        request() {
          window.__hotelPriceRequests += 1;
        }
      };
    `
  });
  app.click({ nav: "map" });
  app.click({ action: "set-map-city", id: "chengdu" });
  assert.match(app.html(), /家尚未开业/);
  assert.match(app.html(), /已优先标注并跳过飞猪查价/);
  app.click({ action: "lookup-hotel-price", id: "JZHAS" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.sandbox.__hotelPriceRequests, 0);
});
