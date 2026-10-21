"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { readSecret } = require("./local-secrets");

const root = path.resolve(__dirname, "..");
const researchDir = path.join(root, "build", "research");
const outputJson = path.join(researchDir, "missing-hotel-prices.json");
const outputJs = path.join(root, "app", "assets", "www", "hotel-prices.js");
const endpoint = "https://flyai.open.fliggy.com/mcp";
const checkIn = process.env.PRICE_CHECK_IN || "2026-10-20";
const checkOut = process.env.PRICE_CHECK_OUT || "2026-10-21";
const delayMs = Math.max(700, Number(process.env.PRICE_DELAY_MS) || 1500);

const authorization =
  "Bearer " + readSecret("FLYAI_API_KEY", { required: true });
const signSecret = readSecret("FLYAI_SIGN_SECRET", { required: true });

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s·,，。()（）\-—_/]/g, "")
    .replace(/大酒店|度假酒店|酒店|宾馆|饭店/g, "");
}

function parsePrice(value) {
  const match = String(value || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  const price = match ? Number(match[0]) : NaN;
  return Number.isFinite(price) && price > 0 ? price : null;
}

function nameVariants(name) {
  return [
    name,
    String(name).replace(/万豪万枫/g, "万枫"),
    String(name).replace(/大酒店$/, "酒店"),
    String(name).replace(/酒店$/, ""),
    String(name).replace(/高新西区|高新区|经开|新区/g, "")
  ].filter((item, index, list) => item && list.indexOf(item) === index);
}

async function callTool(name, args) {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name, arguments: args }
  });
  const timestamp = String(Date.now());
  const nonce = crypto.randomBytes(16).toString("hex");
  const canonical =
    "POST\n/mcp\n" +
    timestamp +
    "\n" +
    nonce +
    "\n" +
    sha256Hex(body) +
    "\n" +
    sha256Hex(authorization);
  const signature = crypto
    .createHmac("sha256", signSecret)
    .update(canonical, "utf8")
    .digest("base64url");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization,
      "x-ttid": "ai2c(sk.clawhub)",
      "user-agent": "BonvoyCompanion/0.6 Android",
      "x-flyai-ts": timestamp,
      "x-flyai-nonce": nonce,
      "x-flyai-sign-ver": "7",
      "x-flyai-sign-alg": "hmac-sha256",
      "x-flyai-sign": signature
    },
    body,
    signal: AbortSignal.timeout(65000)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error("FlyAI HTTP " + response.status + ": " + text.slice(0, 180));
  }
  const rpc = JSON.parse(text);
  if (rpc.error) throw new Error(rpc.error.message || "MCP error");
  const content =
    rpc.result &&
    rpc.result.content &&
    rpc.result.content[0] &&
    rpc.result.content[0].text;
  if (!content) throw new Error("No MCP content");
  const payload = JSON.parse(content);
  if (Number(payload.status) && Number(payload.status) !== 0) {
    throw new Error(payload.message || "FlyAI returned an error");
  }
  return payload;
}

function items(payload) {
  return (payload && payload.data && payload.data.itemList) || [];
}

function findHotel(itemsList, hotel) {
  const target = normalizeName(hotel.name);
  return (
    itemsList.find((item) => normalizeName(item.name) === target) ||
    itemsList.find((item) => {
      const value = normalizeName(item.name);
      return (
        value.length >= 6 &&
        target.length >= 6 &&
        (value.includes(target) || target.includes(value))
      );
    }) ||
    null
  );
}

async function lookupPrice(hotel) {
  let lastError = null;
  for (const keyword of nameVariants(hotel.name)) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const payload = await callTool("search_marriott_hotels", {
          destName: hotel.cityFull || hotel.city || hotel.province,
          keyWords: keyword,
          checkInDate: checkIn,
          checkOutDate: checkOut
        });
        const match = findHotel(items(payload), hotel);
        if (match && parsePrice(match.price)) return match;
        break;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) =>
          setTimeout(resolve, 2500 * (attempt + 1))
        );
      }
    }
  }
  try {
    const payload = await callTool("search_marriott_hotels", {
      destName: hotel.cityFull || hotel.city || hotel.province,
      checkInDate: checkIn,
      checkOutDate: checkOut
    });
    const match = findHotel(items(payload), hotel);
    if (match && parsePrice(match.price)) return match;
  } catch (error) {
    lastError = error;
  }
  if (lastError) throw lastError;
  return null;
}

function writeOutputs(data) {
  fs.writeFileSync(outputJson, JSON.stringify(data), "utf8");
  fs.writeFileSync(
    outputJs,
    "(function (global) {\n" +
      '  "use strict";\n' +
      "  global.APP_PRICE_OVERRIDES = " +
      JSON.stringify(data) +
      ";\n" +
      "  if (typeof module !== \"undefined\" && module.exports) {\n" +
      "    module.exports = global.APP_PRICE_OVERRIDES;\n" +
      "  }\n" +
      "})(typeof window !== \"undefined\" ? window : globalThis);\n",
    "utf8"
  );
}

async function main() {
  require(path.join(root, "app", "assets", "www", "catalog.js"));
  require(path.join(root, "app", "assets", "www", "app-data.js"));
  const hotels = globalThis.APP_DATA.hotels;
  const data = fs.existsSync(outputJson)
    ? JSON.parse(fs.readFileSync(outputJson, "utf8"))
    : {
        generatedAt: null,
        checkIn,
        checkOut,
        hotels: {},
        notFound: {}
      };
  data.checkIn = checkIn;
  data.checkOut = checkOut;
  const pending = hotels.filter(
    (hotel) =>
      !(Number(hotel.price) > 0) &&
      !data.hotels[hotel.id] &&
      (!data.notFound[hotel.id] || process.env.PRICE_RETRY_NOT_FOUND === "1")
  );
  let found = 0;
  let failed = 0;
  for (let index = 0; index < pending.length; index += 1) {
    const hotel = pending[index];
    try {
      const match = await lookupPrice(hotel);
      if (match) {
        data.hotels[hotel.id] = {
          hotelName: hotel.name,
          price: parsePrice(match.price),
          checkIn,
          checkOut,
          source: "Fliggy live starting price",
          fetchedAt: new Date().toISOString(),
          shid: match.shid || "",
          detailUrl: match.detailUrl || "",
          imageUrl: match.mainPic || "",
          nearbyPoi: match.nearbyPoi || "",
          star: match.star || ""
        };
        delete data.notFound[hotel.id];
        found += 1;
      } else {
        data.notFound[hotel.id] = {
          hotelName: hotel.name,
          checkedAt: new Date().toISOString()
        };
      }
    } catch (error) {
      failed += 1;
      data.notFound[hotel.id] = {
        hotelName: hotel.name,
        checkedAt: new Date().toISOString(),
        error: error.message
      };
    }
    if ((index + 1) % 5 === 0 || index + 1 === pending.length) {
      data.generatedAt = new Date().toISOString();
      writeOutputs(data);
      console.log(
        JSON.stringify({
          processed: index + 1,
          pending: pending.length,
          found,
          failed,
          totalPriced: Object.keys(data.hotels).length
        })
      );
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  data.generatedAt = new Date().toISOString();
  writeOutputs(data);
  console.log(
    JSON.stringify({
      finished: true,
      requested: pending.length,
      found,
      failed,
      totalPriced: Object.keys(data.hotels).length
    })
  );
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
