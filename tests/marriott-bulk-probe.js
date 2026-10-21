"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profileDir = path.join(root, "build", "research", "marriott-bulk-profile");
const port = 9343;
const outputPath = path.join(root, "build", "research", "marriott-bulk.json");

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

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text);
    }
    return result.result ? result.result.value : undefined;
  }
}

const captured = JSON.parse(
  fs.readFileSync(
    path.join(root, "build", "research", "marriott-search-network.json"),
    "utf8"
  )
);
const capturedSearch = captured.requests.find((request) =>
  request.url.includes("phoenixShopDatedSearchByGeoQuery")
);
if (!capturedSearch) {
  throw new Error("Captured Marriott search request not found");
}

function bodyFor(offset, limit, distance) {
  const payload = JSON.parse(capturedSearch.postData);
  payload.variables.search.latitude = 35.8617;
  payload.variables.search.longitude = 104.1954;
  payload.variables.search.distance = distance;
  payload.variables.search.options.startDate = "2026-10-20";
  payload.variables.search.options.endDate = "2026-10-21";
  payload.variables.search.options.includeUnavailableProperties = true;
  payload.variables.offset = offset;
  payload.variables.limit = limit;
  return payload;
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
    const aggregate = {
      fetchedAt: new Date().toISOString(),
      requestDate: { checkIn: "2026-10-20", checkOut: "2026-10-21" },
      center: { latitude: 35.8617, longitude: 104.1954 },
      total: null,
      pages: [],
      edges: []
    };
    let offset = 0;
    let pageNumber = 0;
    let total = null;
    while (pageNumber < 40) {
      const payload = bodyFor(offset, 40, 2500000);
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
        await sleep(3000);
        result = await cdp.evaluate(expression);
      }
      if (
        result.status !== 200 ||
        !String(result.contentType || "").includes("application/json")
      ) {
        throw new Error(
          `Marriott page request failed: status=${result.status}, body=${String(
            result.text
          ).slice(0, 300)}`
        );
      }
      const parsed = JSON.parse(result.text);
      const search = parsed.data.search.lowestAvailableRates.searchByGeolocation;
      if (!search) {
        throw new Error("Marriott response missing search data");
      }
      if (total === null) total = search.total;
      aggregate.total = total;
      aggregate.pages.push({
        offset,
        count: search.edges.length,
        total: search.total,
        hasNextPage: search.pageInfo && search.pageInfo.hasNextPage,
        nextOffset: search.pageInfo && search.pageInfo.nextOffset
      });
      aggregate.edges.push(...search.edges);
      pageNumber += 1;
      if (!search.edges.length || aggregate.edges.length >= total) break;
      offset += search.edges.length;
      await sleep(700);
    }
    const unique = new Map();
    aggregate.edges.forEach((edge) => {
      const id = edge && edge.node && edge.node.property && edge.node.property.id;
      if (id) unique.set(id, edge);
    });
    aggregate.uniqueCount = unique.size;
    aggregate.rateCount = Array.from(unique.values()).filter(
      (edge) => edge.node.rates && edge.node.rates.length
    ).length;
    fs.writeFileSync(outputPath, JSON.stringify(aggregate, null, 2));
    const brandCounts = {};
    Array.from(unique.values()).forEach((edge) => {
      const brand = edge.node.property.basicInformation.brand;
      const key = brand ? brand.name : "UNKNOWN";
      brandCounts[key] = (brandCounts[key] || 0) + 1;
    });
    console.log(
      JSON.stringify(
        {
          outputPath,
          total,
          uniqueCount: aggregate.uniqueCount,
          pages: aggregate.pages.length,
          rateCount: aggregate.rateCount,
          brandCounts
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
