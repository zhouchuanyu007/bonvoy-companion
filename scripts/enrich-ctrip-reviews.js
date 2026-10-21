"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const insightJson = path.join(
  root,
  "build",
  "research",
  "hotel-insights.json"
);
const outputJson = path.join(
  root,
  "build",
  "research",
  "hotel-insights-with-ctrip.json"
);
const outputJs = path.join(
  root,
  "app",
  "assets",
  "www",
  "hotel-insights.js"
);
const limit = Math.max(0, Number(process.env.CTRIP_ENRICH_LIMIT) || 0);
const delayMs = Math.max(250, Number(process.env.CTRIP_DELAY_MS) || 700);
const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s·,，。()（）\-—_/]/g, "")
    .replace(/大酒店|度假酒店|酒店|宾馆|饭店/g, "");
}

function decodeHtml(value) {
  const named = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " "
  };
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/&([a-z]+);/gi, (match, name) => named[name] || match)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": userAgent,
      "accept-language": "zh-CN,zh;q=0.9"
    },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.text();
}

async function findCtripHotel(hotel) {
  const query = encodeURIComponent(
    'site:hotels.ctrip.com/hotels "' + hotel.name + '"'
  );
  const html = await fetchText("https://www.bing.com/search?q=" + query);
  const urls = [
    ...new Set(
      [...html.matchAll(/https:\/\/hotels\.ctrip\.com\/hotels\/(\d+)\.html/g)].map(
        (match) => ({
          id: match[1],
          url: "https://hotels.ctrip.com/hotels/" + match[1] + ".html"
        })
      )
    )
  ];
  for (const candidate of urls.slice(0, 5)) {
    try {
      const page = await fetchText(candidate.url);
      const title =
        (page.match(/<title[^>]*>(.*?)<\/title>/s) || [])[1] || "";
      if (normalizeName(title).includes(normalizeName(hotel.name))) {
        return Object.assign(candidate, { page });
      }
    } catch (error) {
      // Try the next public result.
    }
  }
  return null;
}

function extractReviews(html) {
  const reviews = [];
  const seen = new Set();
  for (const match of html.matchAll(
    /components_commentTextPrimary__[^"]*"[^>]*aria-label="([^"]+)"/g
  )) {
    const content = decodeHtml(match[1]);
    if (content.length < 8 || seen.has(content)) continue;
    seen.add(content);
    reviews.push(content);
  }
  for (const match of html.matchAll(
    /components_commentTextSecondary__[^"]*"[^>]*>([^<]+)<\/div>/g
  )) {
    const content = decodeHtml(match[1]);
    if (content.length < 8 || seen.has(content)) continue;
    seen.add(content);
    reviews.push(content);
  }
  return reviews.slice(0, 5);
}

function writeOutputs(data) {
  fs.writeFileSync(insightJson, JSON.stringify(data), "utf8");
  fs.writeFileSync(outputJson, JSON.stringify(data), "utf8");
  fs.writeFileSync(
    outputJs,
    "(function (global) {\n" +
      '  "use strict";\n' +
      "  global.APP_HOTEL_INSIGHTS = " +
      JSON.stringify(data) +
      ";\n" +
      "  if (typeof module !== \"undefined\" && module.exports) {\n" +
      "    module.exports = global.APP_HOTEL_INSIGHTS;\n" +
      "  }\n" +
      "})(typeof window !== \"undefined\" ? window : globalThis);\n",
    "utf8"
  );
}

async function main() {
  if (!fs.existsSync(insightJson)) {
    throw new Error("Run scripts/enrich-hotel-insights.js first");
  }
  require(path.join(root, "app", "assets", "www", "catalog.js"));
  require(path.join(root, "app", "assets", "www", "app-data.js"));
  const hotels = globalThis.APP_DATA.hotels;
  const data = JSON.parse(fs.readFileSync(insightJson, "utf8"));
  data.ctripGeneratedAt = new Date().toISOString();
  data.ctripHotelIds = data.ctripHotelIds || {};
  data.ctripNotFound = data.ctripNotFound || {};
  const pending = hotels
    .filter(
      (hotel) =>
        !process.env.CTRIP_HOTEL_NAME ||
        hotel.name.includes(process.env.CTRIP_HOTEL_NAME)
    )
    .filter(
      (hotel) =>
        process.env.CTRIP_ONLY_WITH_FLYAI !== "1" ||
        (data.hotels[hotel.id] &&
          Object.keys(data.hotels[hotel.id].facilities || {}).length)
    )
    .filter(
      (hotel) =>
        !data.ctripHotelIds[hotel.id] && !data.ctripNotFound[hotel.id]
    )
    .slice(0, limit || undefined);
  let processed = 0;
  let found = 0;
  let failed = 0;
  for (const hotel of pending) {
    processed += 1;
    try {
      const match = await findCtripHotel(hotel);
      if (!match) {
        data.ctripNotFound[hotel.id] = {
          hotelName: hotel.name,
          checkedAt: new Date().toISOString()
        };
      } else {
        const reviews = extractReviews(match.page);
        data.ctripHotelIds[hotel.id] = {
          hotelName: hotel.name,
          hotelId: match.id,
          url: match.url,
          fetchedAt: new Date().toISOString(),
          reviewCount: reviews.length
        };
        if (reviews.length) {
          if (!data.hotels[hotel.id]) {
            data.hotels[hotel.id] = {
              hotelId: hotel.id,
              hotelName: hotel.name,
              fetchedAt: new Date().toISOString(),
              detailUrl: "",
              basics: {},
              policies: {},
              facilities: {},
              nearby: {},
              rooms: [],
              reviews: []
            };
          }
          const existing = new Set(
            (data.hotels[hotel.id].reviews || []).map((review) =>
              String(review.content || "").toLowerCase()
            )
          );
          reviews.forEach((content) => {
            if (existing.has(content.toLowerCase())) return;
            existing.add(content.toLowerCase());
            data.hotels[hotel.id].reviews.push({
              source: "ctrip",
              content,
              fetchedAt: new Date().toISOString(),
              sourceUrl: match.url
            });
          });
          data.hotels[hotel.id].reviews =
            data.hotels[hotel.id].reviews.slice(0, 12);
          found += 1;
        }
      }
    } catch (error) {
      failed += 1;
      data.ctripNotFound[hotel.id] = {
        hotelName: hotel.name,
        checkedAt: new Date().toISOString(),
        error: error.message
      };
    }
    if (processed % 5 === 0 || processed === pending.length) {
      data.hotelCount = Object.keys(data.hotels).length;
      writeOutputs(data);
      console.log(
        JSON.stringify({
          processed,
          pending: pending.length,
          found,
          failed,
          available: Object.keys(data.ctripHotelIds).length
        })
      );
    }
    await sleep(delayMs);
  }
  data.hotelCount = Object.keys(data.hotels).length;
  writeOutputs(data);
  console.log(
    JSON.stringify({
      finished: true,
      processed,
      found,
      failed,
      available: Object.keys(data.ctripHotelIds).length
    })
  );
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
