"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profileDir = path.join(root, "build", "research", "price-refresh-profile");
const port = 9348;
const researchDir = path.join(root, "build", "research");
const reportPath = path.join(researchDir, "marriott-search-network.json");
const outputJs = path.join(root, "app", "assets", "www", "catalog.js");
const progressPath = path.join(researchDir, "price-refresh-progress.json");

require(path.join(root, "app", "assets", "www", "catalog.js"));
const catalog = globalThis.APP_CATALOG;
const network = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const capturedSearch = network.requests.find((request) =>
  request.url.includes("phoenixShopDatedSearchByGeoQuery")
);
if (!capturedSearch) throw new Error("未找到万豪价格查询请求");

if (!profileDir.startsWith(path.join(root, "build", "research") + path.sep)) {
  throw new Error("浏览器临时目录越界");
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
  throw new Error("Chrome 启动失败");
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

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result ? result.result.value : undefined;
  }
}

function dateString(date) {
  return (
    date.getFullYear() +
    "-" +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + date.getDate()).slice(-2)
  );
}

function amountValue(amount) {
  if (!amount || !Number.isFinite(Number(amount.amount))) return null;
  return Math.round(
    Number(amount.amount) / Math.pow(10, Number(amount.decimalPoint) || 0)
  );
}

async function fetchPage(cdp, destination, offset, checkIn, checkOut) {
  const payload = JSON.parse(capturedSearch.postData);
  payload.variables.search.latitude = Number(destination.coords.latitude);
  payload.variables.search.longitude = Number(destination.coords.longitude);
  payload.variables.search.distance = 80000;
  payload.variables.search.options.startDate = checkIn;
  payload.variables.search.options.endDate = checkOut;
  payload.variables.search.options.includeUnavailableProperties = true;
  payload.variables.offset = offset;
  payload.variables.limit = 40;

  const headers = {
    "application-name": "shop",
    accept: "*/*",
    "apollographql-client-version": "v1",
    "apollographql-client-name": "phoenix_shop",
    "content-type": "application/json",
    "graphql-operation-name": "phoenixShopDatedSearchByGeoQuery",
    "graphql-require-safelisting": "true",
    "graphql-operation-signature":
      capturedSearch.headers["graphql-operation-signature"],
    "accept-language": "zh-CN"
  };
  const expression = `fetch('/mi/query/phoenixShopDatedSearchByGeoQuery', {
    method: 'POST',
    headers: ${JSON.stringify(headers)},
    body: ${JSON.stringify(JSON.stringify(payload))}
  }).then(async (response) => ({
    status: response.status,
    contentType: response.headers.get('content-type'),
    text: await response.text()
  }))`;
  let result = await cdp.evaluate(expression);
  if (
    result.status !== 200 ||
    !String(result.contentType || "").includes("application/json")
  ) {
    await sleep(2500);
    result = await cdp.evaluate(expression);
  }
  if (
    result.status !== 200 ||
    !String(result.contentType || "").includes("application/json")
  ) {
    throw new Error("HTTP " + result.status);
  }
  const parsed = JSON.parse(result.text);
  return parsed.data.search.lowestAvailableRates.searchByGeolocation;
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
    await sleep(6500);

    const checkIn = dateString(new Date());
    const checkOut = dateString(new Date(Date.now() + 86400000));
    const hotelMap = new Map(catalog.hotels.map((hotel) => [hotel.id, hotel]));
    const destinations = catalog.destinations
      .filter((destination) => destination.coords)
      .sort((a, b) => {
        const regionRank = { 东北: 0, 华南: 1, 华东: 2 };
        return (
          (regionRank[a.region] ?? 3) - (regionRank[b.region] ?? 3) ||
          a.name.localeCompare(b.name, "zh-CN")
        );
      });
    const progress = {
      checkIn,
      checkOut,
      completed: [],
      failed: [],
      pricedHotels: []
    };

    for (const destination of destinations) {
      try {
        let offset = 0;
        let pageCount = 0;
        const cityPriced = new Set();
        while (pageCount < 3) {
          const search = await fetchPage(
            cdp,
            destination,
            offset,
            checkIn,
            checkOut
          );
          if (!search || !Array.isArray(search.edges)) {
            throw new Error("返回缺少搜索数据");
          }
          for (const edge of search.edges) {
            const hotel = edge && edge.node && edge.node.property;
            if (!hotel || !hotelMap.has(hotel.id)) continue;
            const rates = edge.node.rates || [];
            let cash = null;
            for (const rate of rates) {
              cash = rate && rate.rateModes && rate.rateModes.lowestAverageRate;
              if (cash) break;
            }
            if (!cash) continue;
            const price = amountValue(cash.amount);
            if (!Number.isFinite(price)) continue;
            const record = hotelMap.get(hotel.id);
            record.price = price;
            record.totalPrice = amountValue(cash.totalAmount);
            record.priceMeta = {
              checkIn,
              checkOut,
              currency: cash.amount.currency || "CNY",
              source: "Marriott official public search"
            };
            cityPriced.add(record.id);
            progress.pricedHotels.push(record.id);
          }
          pageCount += 1;
          if (
            !search.pageInfo ||
            !search.pageInfo.hasNextPage ||
            search.edges.length < 40 ||
            offset + search.edges.length >= (Number(search.total) || 0)
          ) {
            break;
          }
          offset += search.edges.length;
          await sleep(450);
        }
        progress.completed.push({
          id: destination.id,
          name: destination.name,
          priced: cityPriced.size
        });
        console.log(
          `[${progress.completed.length}/${destinations.length}] ${destination.name}: ${cityPriced.size}`
        );
      } catch (error) {
        progress.failed.push({
          id: destination.id,
          name: destination.name,
          error: error.message
        });
        console.error(`${destination.name}: ${error.message}`);
      }
      fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
      await sleep(450);
    }

    catalog.priceSnapshot = { checkIn, checkOut };
    catalog.sourceCheckedAt = new Date().toISOString();
    fs.writeFileSync(
      outputJs,
      '(function (global) {\n  "use strict";\n  global.APP_CATALOG = ' +
        JSON.stringify(catalog) +
        ';\n})(typeof window !== "undefined" ? window : globalThis);\n'
    );
    const pricedCount = catalog.hotels.filter((hotel) => hotel.price).length;
    const northeast = catalog.hotels.filter(
      (hotel) => hotel.region === "东北" && hotel.price
    ).length;
    console.log(
      JSON.stringify(
        {
          catalog: outputJs,
          progress: progressPath,
          pricedCount,
          northeastPriced: northeast,
          failedCities: progress.failed.length
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
