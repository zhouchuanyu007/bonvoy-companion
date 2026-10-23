"use strict";

// Fetches Marriott Bonvoy standard redemption prices (points per night) from
// the official marriott.com.cn search, alongside the same-night cash total, and
// writes app/assets/www/hotel-award-points.js.
//
// Usage: node scripts/refresh-award-points.js [checkIn YYYY-MM-DD] [--limit N]

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const researchDir = path.join(root, "build", "research");
const profileDir = path.join(researchDir, "award-points-profile");
const outputJs = path.join(root, "app", "assets", "www", "hotel-award-points.js");
const port = 9356;

require(path.join(root, "app", "assets", "www", "catalog.js"));
const catalog = globalThis.APP_CATALOG;

const args = process.argv.slice(2);
const limitIndex = args.indexOf("--limit");
const destinationLimit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : Infinity;
const dateArg = args.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg));

if (!profileDir.startsWith(researchDir + path.sep)) throw new Error("浏览器临时目录越界");
fs.mkdirSync(researchDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pad = (value) => ("0" + value).slice(-2);
const isoDate = (date) => date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
const usDate = (date) => pad(date.getMonth() + 1) + "/" + pad(date.getDate()) + "/" + date.getFullYear();

function amountValue(amount) {
  if (!amount || !Number.isFinite(Number(amount.amount))) return null;
  return Number(amount.amount) / Math.pow(10, Number(amount.decimalPoint) || 0);
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 1;
    this.pending = new Map();
    this.listeners = [];
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
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
        return;
      }
      this.listeners.forEach((listener) => listener(message));
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
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result ? result.result.value : undefined;
  }
}

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
  throw new Error("Chrome 启动失败");
}

// Load the official points search page once and capture its GraphQL request,
// which we then replay per destination with the same signed headers.
async function captureTemplate(cdp, checkIn, checkOut) {
  const captured = [];
  cdp.listeners.push((message) => {
    if (
      message.method === "Network.requestWillBeSent" &&
      message.params.request.url.includes("phoenixShopDatedSearchByDestinationQuery")
    ) {
      captured.push(message.params.request);
    }
  });
  const url =
    "https://www.marriott.com.cn/search/findHotels.mi?destinationAddress.city=Shanghai" +
    "&fromDate=" + encodeURIComponent(usDate(checkIn)) +
    "&toDate=" + encodeURIComponent(usDate(checkOut)) +
    "&useRewardsPoints=true&roomCount=1&numAdultsPerRoom=1";
  await cdp.send("Page.navigate", { url });
  for (let index = 0; index < 60 && !captured.length; index += 1) await sleep(500);
  if (!captured.length) throw new Error("未捕获到万豪积分搜索请求");
  await sleep(1500);
  return captured[0];
}

async function searchPage(cdp, template, destinationName, offset, checkIn, checkOut) {
  const payload = JSON.parse(template.postData);
  payload.variables.search.destination = destinationName;
  payload.variables.search.options.startDate = isoDate(checkIn);
  payload.variables.search.options.endDate = isoDate(checkOut);
  payload.variables.offset = offset;
  payload.variables.limit = 40;
  const keep = [
    "application-name", "accept", "apollographql-client-version", "apollographql-client-name",
    "content-type", "graphql-operation-name", "graphql-require-safelisting", "graphql-operation-signature"
  ];
  const headers = { "accept-language": "zh-CN" };
  keep.forEach((key) => {
    if (template.headers[key]) headers[key] = template.headers[key];
  });
  const expression = `fetch('/mi/query/phoenixShopDatedSearchByDestinationQuery', {
    method: 'POST', headers: ${JSON.stringify(headers)}, body: ${JSON.stringify(JSON.stringify(payload))}
  }).then(async (response) => ({ status: response.status, type: response.headers.get('content-type'), text: await response.text() }))`;
  let result = await cdp.evaluate(expression);
  if (result.status !== 200 || !String(result.type || "").includes("json")) {
    await sleep(3000);
    result = await cdp.evaluate(expression);
  }
  if (result.status !== 200 || !String(result.type || "").includes("json")) throw new Error("HTTP " + result.status);
  const parsed = JSON.parse(result.text);
  return parsed.data && parsed.data.search && parsed.data.search.lowestAvailableRates.searchByDestination;
}

function readRates(rates) {
  let points = null;
  let cashTotal = null;
  let currency = null;
  let available = false;
  (rates || []).forEach((rate) => {
    const modes = rate && rate.rateModes;
    if (!modes) return;
    if (modes.pointsPerUnit && rate.rateCategory && rate.rateCategory.value === "MRW") {
      points = Number(modes.pointsPerUnit.points) || null;
      available = rate.status && rate.status.code === "AvailableForSale";
    }
    if (modes.lowestAverageRate && cashTotal === null) {
      cashTotal = amountValue(modes.lowestAverageRate.totalAmount);
      currency = (modes.lowestAverageRate.totalAmount && modes.lowestAverageRate.totalAmount.currency) || null;
    }
  });
  return { points, cashTotal, currency, available };
}

(async () => {
  const checkIn = dateArg ? new Date(dateArg + "T00:00:00") : new Date(Date.now() + 14 * 86400000);
  const checkOut = new Date(checkIn.getTime() + 86400000);
  const hotelIds = new Set(catalog.hotels.map((hotel) => hotel.id));
  const cities = Array.from(new Set(catalog.hotels.map((hotel) => hotel.cityFull || hotel.city).filter(Boolean)));
  const records = {};
  const failed = [];
  const chrome = spawn(
    chromePath,
    ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-allow-origins=*",
      `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, "about:blank"],
    { stdio: "ignore", windowsHide: true }
  );
  let cdp;
  try {
    cdp = new Cdp((await getTarget()).webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Network.enable");
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    const template = await captureTemplate(cdp, checkIn, checkOut);
    const queue = cities.slice(0, destinationLimit);
    for (const [index, city] of queue.entries()) {
      try {
        let offset = 0;
        let found = 0;
        for (let pageCount = 0; pageCount < 5; pageCount += 1) {
          const search = await searchPage(cdp, template, city, offset, checkIn, checkOut);
          if (!search || !Array.isArray(search.edges)) throw new Error("返回缺少搜索数据");
          search.edges.forEach((edge) => {
            const id = edge && edge.node && edge.node.property && edge.node.property.id;
            if (!id || !hotelIds.has(id) || records[id]) return;
            const rate = readRates(edge.node.rates);
            if (!rate.points) return;
            records[id] = rate;
            found += 1;
          });
          if (!search.pageInfo || !search.pageInfo.hasNextPage || search.edges.length < 40) break;
          offset += search.edges.length;
          await sleep(500);
        }
        console.log(`[${index + 1}/${queue.length}] ${city}: ${found}`);
      } catch (error) {
        failed.push({ city, error: error.message });
        console.error(`${city}: ${error.message}`);
      }
      await sleep(500);
    }
    const output = {
      generatedAt: new Date().toISOString(),
      checkIn: isoDate(checkIn),
      checkOut: isoDate(checkOut),
      source: "marriott.com.cn official search, standard redemption (MRW)",
      hotels: records
    };
    fs.writeFileSync(
      outputJs,
      "(function (global) {\n  \"use strict\";\n  // Generated by scripts/refresh-award-points.js. Do not edit by hand.\n  global.APP_AWARD_POINTS = " +
        JSON.stringify(output) +
        ";\n})(typeof window !== \"undefined\" ? window : globalThis);\n"
    );
    console.log(JSON.stringify({ hotels: Object.keys(records).length, cities: queue.length, failed: failed.length }, null, 2));
  } catch (error) {
    console.error(error.stack || error);
    process.exitCode = 1;
  } finally {
    if (cdp) cdp.ws.close();
    chrome.kill();
  }
})();
