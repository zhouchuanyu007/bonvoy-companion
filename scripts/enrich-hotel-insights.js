"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { readSecret } = require("./local-secrets");

const root = path.resolve(__dirname, "..");
const researchDir = path.join(root, "build", "research");
const outputJson = path.join(researchDir, "hotel-insights.json");
const outputJs = path.join(root, "app", "assets", "www", "hotel-insights.js");
const endpoint = "https://flyai.open.fliggy.com/mcp";
const concurrency = Math.max(
  1,
  Math.min(5, Number(process.env.HOTEL_INSIGHT_CONCURRENCY) || 3)
);
const maxReviewRequests = Math.max(
  1,
  Math.min(8, Number(process.env.HOTEL_INSIGHT_REVIEW_REQUESTS) || 4)
);
const requestDelayMs = Math.max(
  250,
  Number(process.env.HOTEL_INSIGHT_DELAY_MS) || 1200
);
const limit = Math.max(0, Number(process.env.HOTEL_INSIGHT_LIMIT) || 0);

const apiKey = readSecret("FLYAI_API_KEY", { required: true });
const signSecret = readSecret("FLYAI_SIGN_SECRET", { required: true });
const authorization = "Bearer " + apiKey;

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s·,，。()（）\-—_/]/g, "")
    .replace(/大酒店|度假酒店|酒店|宾馆|饭店/g, "");
}

function cleanText(value) {
  return String(value || "")
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(value) {
  const match = String(value || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function hotelNameVariants(name) {
  const value = cleanText(name);
  return [
    value,
    value.replace(/万豪万枫/g, "万枫"),
    value.replace(/大酒店$/, "酒店"),
    value.replace(/酒店$/, ""),
    value.replace(/福朋喜来登/g, "福朋"),
    value.replace(/高新西区|高新区|经开|新区/g, "")
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
  const raw = await response.text();
  if (!response.ok) {
    throw new Error("FlyAI HTTP " + response.status + ": " + raw.slice(0, 180));
  }
  const rpc = JSON.parse(raw);
  if (rpc.error) throw new Error(rpc.error.message || "FlyAI MCP error");
  const text =
    rpc.result &&
    rpc.result.content &&
    rpc.result.content[0] &&
    rpc.result.content[0].text;
  if (!text) throw new Error("FlyAI response has no content");
  const payload = JSON.parse(text);
  if (Number(payload.status) && Number(payload.status) !== 0) {
    throw new Error(payload.message || "FlyAI returned an error");
  }
  return payload;
}

function splitNearby(value, maxItems) {
  return String(value || "")
    .split(/[;；]/)
    .map(cleanText)
    .filter(Boolean)
    .slice(0, maxItems);
}

function compactHotel(item, hotel, fetchedAt) {
  const info = item.hotelInfo || {};
  const basics = info["酒店基础信息"] || {};
  const policies = info["酒店政策"] || {};
  const nearby = info["酒店周边"] || {};
  const reviews = [];
  const seen = new Set();
  for (const review of item.reviews || []) {
    const content = cleanText(review && review.content);
    const key = content.toLowerCase();
    if (content.length < 8 || seen.has(key)) continue;
    seen.add(key);
    reviews.push({
      source: "fliggy",
      content: content.slice(0, 700),
      fetchedAt
    });
    if (reviews.length >= 10) break;
  }
  const rooms = (item.roomLayers || [])
    .map((room) => {
      const rates = (room.rateLayers || [])
        .map((rate) => ({
          price: parsePrice(rate["最终价格"]),
          occupancy: cleanText(rate["其他政策"]),
          breakfast: cleanText(rate["早餐政策"]),
          policy: cleanText(rate["商品信息"])
        }))
        .filter((rate) => rate.price)
        .sort((a, b) => a.price - b.price);
      return {
        name: cleanText(room.name),
        bed: cleanText(room["床政策"]),
        sizeAndFloor: cleanText(room["热门设施"]),
        facilities: cleanText(room["其他设施"]).slice(0, 1800),
        rates: rates.slice(0, 3)
      };
    })
    .filter((room) => room.name)
    .slice(0, 12);
  return {
    hotelId: hotel.id,
    hotelName: cleanText(basics["酒店名称"] || hotel.name),
    fetchedAt,
    detailUrl: item.detailUrl || "",
    basics: {
      address: cleanText(basics["酒店地址"]),
      level: cleanText(basics["酒店等级"]),
      phone: cleanText(basics["酒店联系电话"]),
      rooms: cleanText(basics["房间数量"]),
      opening: cleanText(basics["开业时间"]),
      renovation: cleanText(basics["装修时间"]),
      checkIn: cleanText(basics["入住方式"]),
      business: cleanText(basics["商务出行"]).slice(0, 600),
      pool: cleanText(basics["恒温泳池"]),
      guests: cleanText(basics["可接待人群"])
    },
    policies: {
      checkInOut: cleanText(policies["入离政策"]),
      breakfast: cleanText(policies["早餐政策"]),
      children: cleanText(policies["儿童政策"]),
      pets: cleanText(policies["宠物政策"]),
      deposit: cleanText(policies["押金政策"]),
      extraBed: cleanText(policies["加床费用"]),
      toiletries: cleanText(policies["洗漱用品政策"])
    },
    facilities: info["酒店设施"] || {},
    nearby: {
      transport: splitNearby(nearby["交通"], 8),
      attractions: splitNearby(nearby["景点"], 10),
      food: splitNearby(nearby["美食"], 8),
      shopping: splitNearby(nearby["购物"], 8)
    },
    rooms,
    reviews
  };
}

async function enrichHotel(hotel) {
  const fetchedAt = new Date().toISOString();
  const allReviews = [];
  const seenReviews = new Set();
  let detailUrl = "";
  let info = null;
  let rooms = [];
  let lastError = null;
  const keywords = ["服务", "位置", "早餐", "设施", "房间", "隔音", "泳池", "酒廊"];
  for (const keyword of keywords.slice(0, maxReviewRequests)) {
    if (seenReviews.size >= 10) break;
    let item = null;
    const candidateNames =
      process.env.HOTEL_INSIGHT_FAST === "1"
        ? [hotel.name]
        : hotelNameVariants(hotel.name);
    for (const candidateName of candidateNames) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const payload = await callTool("get_marriott_hotel_info", {
            hotelName: candidateName,
            reviewKeyword: keyword
          });
          item =
            payload.data &&
            payload.data.itemList &&
            payload.data.itemList[0];
          break;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) =>
            setTimeout(resolve, 1500 * (attempt + 1))
          );
        }
      }
      if (item && item.hotelInfo) break;
    }
    if (!item || !item.hotelInfo) {
      try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const after = new Date(tomorrow);
        after.setDate(after.getDate() + 1);
        const dateValue = (date) => date.toISOString().slice(0, 10);
        const search = await callTool("search_marriott_hotels", {
          destName: hotel.cityFull || hotel.city || hotel.province,
          keyWords: hotel.name,
          checkInDate: dateValue(tomorrow),
          checkOutDate: dateValue(after)
        });
        const candidates =
          (search.data && search.data.itemList) || [];
        const matched = candidates.find((candidate) => {
          const left = normalizeName(candidate.name);
          const right = normalizeName(hotel.name);
          return left.includes(right) || right.includes(left);
        });
        if (matched && matched.shid) {
          const detail = await callTool("get_marriott_hotel_info", {
            shid: Number(matched.shid),
            reviewKeyword: keyword
          });
          item =
            detail.data &&
            detail.data.itemList &&
            detail.data.itemList[0];
        }
      } catch (error) {
        lastError = error;
      }
    }
    if (!item) continue;
    const returnedName = cleanText(
      item.hotelInfo &&
        item.hotelInfo["酒店基础信息"] &&
        item.hotelInfo["酒店基础信息"]["酒店名称"]
    );
    if (
      returnedName &&
      !normalizeName(returnedName).includes(normalizeName(hotel.name)) &&
      !normalizeName(hotel.name).includes(normalizeName(returnedName))
    ) {
      continue;
    }
    detailUrl = item.detailUrl || detailUrl;
    info = item.hotelInfo || info;
    rooms = item.roomLayers || rooms;
    for (const review of item.reviews || []) {
      const content = cleanText(review && review.content);
      const key = content.toLowerCase();
      if (!content || seenReviews.has(key)) continue;
      seenReviews.add(key);
      allReviews.push(review);
      if (seenReviews.size >= 10) break;
    }
  }
  if (!info) {
    throw lastError || new Error("No hotel detail returned");
  }
  const compact = compactHotel(
    { hotelInfo: info, reviews: allReviews, roomLayers: rooms, detailUrl },
    hotel,
    fetchedAt
  );
  return compact;
}

function writeOutputs(data) {
  const ordered = {};
  Object.keys(data.hotels)
    .sort()
    .forEach((id) => {
      ordered[id] = data.hotels[id];
    });
  data.hotels = ordered;
  fs.mkdirSync(path.dirname(outputJson), { recursive: true });
  fs.writeFileSync(outputJson, JSON.stringify(data), "utf8");
  const js =
    "(function (global) {\n" +
    '  "use strict";\n' +
    "  global.APP_HOTEL_INSIGHTS = " +
    JSON.stringify(data) +
    ";\n" +
    "  if (typeof module !== \"undefined\" && module.exports) {\n" +
    "    module.exports = global.APP_HOTEL_INSIGHTS;\n" +
    "  }\n" +
    "})(typeof window !== \"undefined\" ? window : globalThis);\n";
  fs.writeFileSync(outputJs, js, "utf8");
}

async function main() {
  require(path.join(root, "app", "assets", "www", "catalog.js"));
  require(path.join(root, "app", "assets", "www", "app-data.js"));
  const allHotels = globalThis.APP_DATA.hotels;
  const priceTargetIds =
    process.env.FLYAI_MISSING_PRICE_ONLY === "1" &&
    fs.existsSync(path.join(researchDir, "missing-hotel-prices.json"))
      ? (() => {
          const priceData = JSON.parse(
            fs.readFileSync(
              path.join(researchDir, "missing-hotel-prices.json"),
              "utf8"
            )
          );
          return new Set([
            ...Object.keys(priceData.hotels || {}),
            ...Object.keys(priceData.notFound || {})
          ]);
        })()
      : null;
  const data = fs.existsSync(outputJson)
    ? JSON.parse(fs.readFileSync(outputJson, "utf8"))
    : {
        generatedAt: null,
        source: "Fliggy get_marriott_hotel_info",
        reviewDateCoverage:
          "Fliggy detail API did not return review dates; records are fetchedAt timestamps, not stay dates.",
        hotelCount: 0,
        failures: {},
        hotels: {}
      };
  data.failures = data.failures || {};
  const pending = allHotels
    .filter((hotel) => !priceTargetIds || priceTargetIds.has(hotel.id))
    .filter((hotel) => {
      const cityFilter = String(process.env.FLYAI_CITY_FILTER || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      return (
        !cityFilter.length ||
        cityFilter.some(
          (name) =>
            String(hotel.city || "").includes(name) ||
            String(hotel.province || "").includes(name)
        )
      );
    })
    .filter(
      (hotel) =>
        !process.env.FLYAI_HOTEL_NAME ||
        hotel.name.includes(process.env.FLYAI_HOTEL_NAME)
    )
    .filter((hotel) => {
      const existing = data.hotels[hotel.id];
      return !existing || !Object.keys(existing.facilities || {}).length;
    })
    .slice(0, limit || undefined);
  let nextIndex = 0;
  let completed = 0;
  let failed = 0;

  async function worker() {
    while (nextIndex < pending.length) {
      const index = nextIndex;
      nextIndex += 1;
      const hotel = pending[index];
      try {
        const compact = await enrichHotel(hotel);
        const existing = data.hotels[hotel.id] || {};
        const seenReviews = new Set();
        compact.reviews = [
          ...(compact.reviews || []),
          ...(existing.reviews || [])
        ].filter((review) => {
          const key = String(review.content || "").trim().toLowerCase();
          if (!key || seenReviews.has(key)) return false;
          seenReviews.add(key);
          return true;
        });
        data.hotels[hotel.id] = Object.assign({}, existing, compact, {
          reviews: compact.reviews.slice(0, 12)
        });
        delete data.failures[hotel.id];
        completed += 1;
      } catch (error) {
        failed += 1;
        data.failures[hotel.id] = {
          hotelName: hotel.name,
          failedAt: new Date().toISOString(),
          error: error.message
        };
        console.error(
          "[" +
            (index + 1) +
            "/" +
            pending.length +
            "] " +
            hotel.name +
            ": " +
            error.message
        );
      }
      if ((completed + failed) % 10 === 0 || nextIndex === pending.length) {
        data.generatedAt = new Date().toISOString();
        data.hotelCount = Object.keys(data.hotels).length;
        writeOutputs(data);
        console.log(
          JSON.stringify({
            processed: completed + failed,
            pending: pending.length,
            enriched: data.hotelCount,
            failed
          })
        );
      }
      await new Promise((resolve) => setTimeout(resolve, requestDelayMs));
    }
  }

  console.log(
    JSON.stringify({
      totalHotels: allHotels.length,
      alreadyEnriched: Object.keys(data.hotels).length,
      pending: pending.length,
      concurrency
    })
  );
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  data.generatedAt = new Date().toISOString();
  data.hotelCount = Object.keys(data.hotels).length;
  writeOutputs(data);
  console.log(
    JSON.stringify({
      finished: true,
      enriched: data.hotelCount,
      failed,
      output: outputJson
    })
  );
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
