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
function boot({ emptyCatalog = false } = {}) {
  const elements = new Map();
  for (const id of ["app-main", "app-header", "bottom-nav", "sheet", "sheet-backdrop", "toast"]) {
    elements.set(id, {
      innerHTML: "", dataset: {}, hidden: true,
      classList: { add() {}, remove() {} }, addEventListener() {}
    });
  }
  const listeners = {};
  const windowListeners = {};
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
    localStorage: { getItem: () => null, setItem() {} },
    addEventListener: (event, handler) => { windowListeners[event] = handler; },
    setTimeout() {}, clearTimeout() {}, scrollTo() {}
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  for (const file of ["catalog.js", "hotel-prices.js", "app-data.js", "logic.js"]) {
    if (emptyCatalog && file === "catalog.js") continue;
    vm.runInContext(fs.readFileSync(path.join(www, file), "utf8"), context, { filename: file });
  }
  vm.runInContext(fs.readFileSync(path.join(www, "app.js"), "utf8"), context, { filename: "app.js" });
  return {
    elements, history, listeners,
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
