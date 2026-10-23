"use strict";

// Derives the compact per-hotel signals used by the happiness ranking from the
// large lazy-loaded detail bundle, so the ranking never needs to download it.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const www = path.join(root, "app", "assets", "www");
const output = path.join(www, "hotel-value-signals.js");

function loadInsights() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.runInNewContext(
    fs.readFileSync(path.join(www, "hotel-insights.js"), "utf8"),
    sandbox,
    { filename: "hotel-insights.js" }
  );
  vm.runInNewContext(
    fs.readFileSync(path.join(www, "catalog.js"), "utf8"),
    sandbox,
    { filename: "catalog.js" }
  );
  const provinces = {};
  ((sandbox.APP_CATALOG && sandbox.APP_CATALOG.hotels) || []).forEach((hotel) => {
    provinces[hotel.id] = hotel.province || "";
  });
  return {
    insights: sandbox.APP_HOTEL_INSIGHTS || { hotels: {} },
    provinces
  };
}

// Ordered from most to least scenic; the first match in room names wins.
const VIEW_PATTERNS = [
  { label: "海景", pattern: /海景|海滨|观海|全海|海湾景/ },
  { label: "湖景", pattern: /湖景|西湖|湖畔/ },
  { label: "江景", pattern: /江景|外滩|滨江/ },
  { label: "河景", pattern: /河景/ },
  { label: "雪山景", pattern: /雪山/ },
  { label: "山景", pattern: /山景/ },
  { label: "地标景", pattern: /地标景|塔景/ },
  { label: "园景", pattern: /园景|花园景/ },
  { label: "泳池景", pattern: /泳池景/ },
  { label: "城景", pattern: /城景|城市景观|市景/ }
];

function bestView(text) {
  const found = VIEW_PATTERNS.find((item) => item.pattern.test(text));
  return found ? found.label : "";
}

function parseBreakfast(policy) {
  const text = String(policy || "").trim();
  if (!text) return null;
  if (/不提供早餐/.test(text)) return { type: "none", cuisines: 0, price: 0 };
  const types = (text.match(/类型:([^;]*)/) || [])[1] || "";
  const form = (text.match(/形式:([^;]*)/) || [])[1] || "";
  const cuisines = types
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter((item) => item && item !== "其他").length;
  const priceMatch = form.match(/(\d{2,4})\s*元/);
  const type = /自助/.test(form)
    ? "buffet"
    : /套餐/.test(form)
      ? "set"
      : /单点/.test(form)
        ? "alacarte"
        : "other";
  return { type, cuisines, price: priceMatch ? Number(priceMatch[1]) : 0 };
}

function nearbyWithin(list, pattern, maxKm) {
  return (list || []).some((item) => {
    if (!pattern.test(item)) return false;
    const km = String(item).match(/([\d.]+)\s*公里/);
    const meters = String(item).match(/(\d+)\s*米/);
    const distance = km ? Number(km[1]) : meters ? Number(meters[1]) / 1000 : Infinity;
    return distance <= maxKm;
  });
}

// Ski resort destinations where a winter stay is genuinely about skiing.
// Urban indoor ski halls near city hotels are intentionally excluded.
const SKI_DESTINATIONS = /崇礼|张家口|长白山|吉林市|北大湖|万科松花湖|亚布力|阿勒泰|禾木|喀纳斯|可可托海|将军山|延庆|太舞|云顶|富龙|万龙|松花湖|雪乡/;

// Coastal provinces; inland "beaches" are usually water parks or lake sand.
const COASTAL_PROVINCES = /海南|广东|广西|福建|浙江|上海|江苏|山东|河北|天津|辽宁|香港|澳门|台湾/;

function signalsFor(insight, province) {
  const rooms = Array.isArray(insight.rooms) ? insight.rooms : [];
  const roomNames = rooms.map((room) => room.name || "").join("|");
  const roomFacilities = rooms.map((room) => room.facilities || "").join("|");
  const facilities = JSON.stringify(insight.facilities || {});
  const basics = JSON.stringify(insight.basics || {});
  const attractions = (insight.nearby && insight.nearby.attractions) || [];
  const namedView = bestView(roomNames);
  const listedView = namedView ? "" : bestView(roomFacilities);
  const features = [];
  const address = (insight.basics && insight.basics.address) || "";
  const coastal = COASTAL_PROVINCES.test(province || address);
  const realBeach = (attractions || []).filter((item) => !/水公园|乐园|游乐|湖/.test(item));
  if (
    coastal &&
    (namedView === "海景" || nearbyWithin(realBeach, /海滩|沙滩|海滨浴场/, 2))
  ) {
    features.push("beach");
  }
  // Only count hot springs the hotel itself lists, not ones named in addresses.
  if (/温泉/.test(facilities + roomNames) || /温泉/.test(insight.hotelName || "")) {
    features.push("spring");
  }
  const location = (insight.hotelName || "") + " " + ((insight.basics && insight.basics.address) || "");
  if (
    SKI_DESTINATIONS.test(location) ||
    nearbyWithin(attractions, /滑雪度假区|国际滑雪|滑雪旅游度假/, 15)
  ) {
    features.push("ski");
  }
  if (/山景|雪山/.test(roomNames)) features.push("mountain");
  if (/湖景|西湖/.test(roomNames)) features.push("lake");
  const signal = {
    gym: /健身/.test(facilities) ? 1 : 0,
    view: namedView || listedView,
    viewInName: namedView ? 1 : 0
  };
  const breakfast = parseBreakfast(insight.policies && insight.policies.breakfast);
  if (breakfast) signal.breakfast = breakfast;
  if (features.length) signal.features = features;
  return signal;
}

function main() {
  const { insights, provinces } = loadInsights();
  const hotels = {};
  Object.keys(insights.hotels || {})
    .sort()
    .forEach((id) => {
      hotels[id] = signalsFor(insights.hotels[id], provinces[id]);
    });
  const payload = {
    generatedAt: insights.generatedAt || null,
    source: "Derived from hotel-insights.js by scripts/build-value-signals.js",
    hotelCount: Object.keys(hotels).length,
    hotels
  };
  const source =
    "(function (global) {\n" +
    '  "use strict";\n' +
    "  // Generated by scripts/build-value-signals.js. Do not edit by hand.\n" +
    "  global.APP_VALUE_SIGNALS = " +
    JSON.stringify(payload) +
    ";\n" +
    '  if (typeof module !== "undefined" && module.exports) {\n' +
    "    module.exports = global.APP_VALUE_SIGNALS;\n" +
    "  }\n" +
    '})(typeof window !== "undefined" ? window : globalThis);\n';
  fs.writeFileSync(output, source);
  console.log(
    "Wrote " + path.relative(root, output) + " (" + payload.hotelCount + " hotels, " +
      source.length + " bytes)"
  );
}

if (require.main === module) main();

module.exports = { parseBreakfast, bestView, signalsFor };
