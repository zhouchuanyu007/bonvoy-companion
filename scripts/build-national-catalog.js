"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const researchDir = path.join(root, "build", "research");
const cityBoundaryDir = path.join(researchDir, "city-boundaries");
const outputJson = path.join(researchDir, "national-catalog.json");
const outputJs = path.join(root, "app", "assets", "www", "catalog.js");

const raw = JSON.parse(
  fs.readFileSync(path.join(researchDir, "marriott-bulk.json"), "utf8")
);
const provinceGeo = JSON.parse(
  fs.readFileSync(path.join(researchDir, "china-provinces.json"), "utf8")
);
require(path.join(root, "app", "assets", "www", "data.js"));
const currentData = globalThis.APP_DATA;
const curatedDestinations = currentData.destinations;

const REGION_BY_PROVINCE = {
  北京市: "华北",
  天津市: "华北",
  河北省: "华北",
  山西省: "华北",
  内蒙古自治区: "华北",
  辽宁省: "东北",
  吉林省: "东北",
  黑龙江省: "东北",
  上海市: "华东",
  江苏省: "华东",
  浙江省: "华东",
  安徽省: "华东",
  福建省: "华东",
  江西省: "华东",
  山东省: "华东",
  台湾省: "华东",
  河南省: "华中",
  湖北省: "华中",
  湖南省: "华中",
  广东省: "华南",
  广西壮族自治区: "华南",
  海南省: "华南",
  香港特别行政区: "华南",
  澳门特别行政区: "华南",
  重庆市: "西南",
  四川省: "西南",
  贵州省: "西南",
  云南省: "西南",
  西藏自治区: "西南",
  陕西省: "西北",
  甘肃省: "西北",
  青海省: "西北",
  宁夏回族自治区: "西北",
  新疆维吾尔自治区: "西北"
};

const BRAND_NAME_ZH = {
  RZ: "丽思卡尔顿",
  XR: "瑞吉",
  EB: "艾迪逊",
  LC: "豪华精选",
  WH: "W 酒店",
  JW: "JW 万豪",
  MC: "万豪",
  SI: "喜来登",
  DE: "德尔塔",
  MD: "艾美",
  WI: "威斯汀",
  AK: "傲途格精选",
  DS: "设计酒店",
  BR: "万丽",
  TX: "臻品之选",
  CY: "万怡",
  FP: "福朋喜来登",
  FI: "万枫",
  AR: "AC 酒店",
  AL: "雅乐轩",
  OX: "Moxy",
  EL: "源宿",
  SH: "SpringHill Suites",
  RI: "Residence Inn",
  TS: "TownePlace Suites",
  ER: "万豪行政公寓",
  BA: "万豪旅享家公寓",
  BU: "宝格丽",
  SE: "Series by Marriott",
  CM: "citizenM",
  XE: "City Express"
};

const LUXURY_BRANDS = new Set(["RZ", "XR", "EB", "LC", "WH", "JW", "BU", "BG"]);
const PREMIUM_BRANDS = new Set([
  "MC",
  "SI",
  "DE",
  "MD",
  "WI",
  "AK",
  "DS",
  "BR",
  "TX",
  "ER",
  "BA"
]);

const MUNICIPALITIES = new Set([
  "北京市",
  "天津市",
  "上海市",
  "重庆市",
  "香港特别行政区",
  "澳门特别行政区",
  "台湾省"
]);

function stripProvinceSuffix(name) {
  return String(name || "")
    .replace(/特别行政区$/, "")
    .replace(/维吾尔自治区$/, "")
    .replace(/壮族自治区$/, "")
    .replace(/回族自治区$/, "")
    .replace(/自治区$/, "")
    .replace(/省$/, "")
    .replace(/市$/, "");
}

function cleanText(value) {
  return String(value || "")
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

function stripCitySuffix(name) {
  return String(name || "")
    .replace(/特别行政区$/, "")
    .replace(/自治州$/, "")
    .replace(/地区$/, "")
    .replace(/盟$/, "")
    .replace(/市$/, "");
}

function geometryBbox(geometry) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  function visit(value) {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      minX = Math.min(minX, value[0]);
      maxX = Math.max(maxX, value[0]);
      minY = Math.min(minY, value[1]);
      maxY = Math.max(maxY, value[1]);
      return;
    }
    value.forEach(visit);
  }
  visit(geometry.coordinates);
  return [minX, minY, maxX, maxY];
}

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng, lat, polygon) {
  if (!polygon || !polygon.length || !pointInRing(lng, lat, polygon[0])) {
    return false;
  }
  for (let index = 1; index < polygon.length; index += 1) {
    if (pointInRing(lng, lat, polygon[index])) return false;
  }
  return true;
}

function geometryContains(geometry, lng, lat) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    return pointInPolygon(lng, lat, geometry.coordinates);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) =>
      pointInPolygon(lng, lat, polygon)
    );
  }
  return false;
}

const provinceFeatures = provinceGeo.features
  .filter((feature) => feature.properties && feature.properties.name)
  .map((feature) => ({
    feature,
    properties: feature.properties,
    bbox: geometryBbox(feature.geometry),
    shortName: stripProvinceSuffix(feature.properties.name),
    region: REGION_BY_PROVINCE[feature.properties.name] || "其他"
  }));

const cityFeaturesByProvince = new Map();
for (const province of provinceFeatures) {
  const code = String(province.properties.adcode);
  const file = path.join(cityBoundaryDir, code + ".json");
  if (!fs.existsSync(file) || MUNICIPALITIES.has(province.properties.name)) {
    continue;
  }
  const geo = JSON.parse(fs.readFileSync(file, "utf8"));
  const cities = geo.features
    .filter((feature) => feature.properties && feature.properties.level === "city")
    .map((feature) => ({
      feature,
      properties: feature.properties,
      bbox: geometryBbox(feature.geometry),
      shortName: stripCitySuffix(feature.properties.name)
    }));
  cityFeaturesByProvince.set(province.properties.name, cities);
}

function findProvince(lng, lat) {
  return (
    provinceFeatures.find(
      (province) =>
        lng >= province.bbox[0] &&
        lng <= province.bbox[2] &&
        lat >= province.bbox[1] &&
        lat <= province.bbox[3] &&
        geometryContains(province.feature.geometry, lng, lat)
    ) || null
  );
}

function squaredDistance(a, b, latitude) {
  const lngScale = Math.cos((latitude * Math.PI) / 180);
  const dx = (a[0] - b[0]) * lngScale;
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function findCity(province, lng, lat) {
  if (!province) {
    return { shortName: "未知", adcode: null, region: "其他" };
  }
  if (MUNICIPALITIES.has(province.properties.name)) {
    return {
      shortName: province.shortName,
      adcode: province.properties.adcode,
      region: province.region,
      fullName: province.properties.name,
      center: province.properties.center || province.properties.centroid
    };
  }
  const cities = cityFeaturesByProvince.get(province.properties.name) || [];
  const direct = cities.find(
    (city) =>
      lng >= city.bbox[0] &&
      lng <= city.bbox[2] &&
      lat >= city.bbox[1] &&
      lat <= city.bbox[3] &&
      geometryContains(city.feature.geometry, lng, lat)
  );
  if (direct) {
    return {
      shortName: direct.shortName,
      adcode: direct.properties.adcode,
      region: province.region,
      fullName: direct.properties.name,
      center: direct.properties.center || direct.properties.centroid
    };
  }
  let nearest = null;
  let nearestDistance = Infinity;
  cities.forEach((city) => {
    const center = city.properties.center || city.properties.centroid;
    if (!center) return;
    const distance = squaredDistance([lng, lat], center, lat);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = city;
    }
  });
  if (nearest) {
    return {
      shortName: nearest.shortName,
      adcode: nearest.properties.adcode,
      region: province.region,
      fullName: nearest.properties.name,
      center: nearest.properties.center || nearest.properties.centroid
    };
  }
  return {
    shortName: province.shortName,
    adcode: province.properties.adcode,
    region: province.region,
    fullName: province.properties.name,
    center: province.properties.center || province.properties.centroid
  };
}

function haversineKm(a, b) {
  const radius = 6371;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function brandTier(brandId) {
  if (LUXURY_BRANDS.has(brandId)) return "奢华";
  if (PREMIUM_BRANDS.has(brandId)) return "高端";
  return "精选";
}

function priceFromRates(rates) {
  for (const rate of rates || []) {
    const cash = rate && rate.rateModes && rate.rateModes.lowestAverageRate;
    const amount = cash && cash.amount;
    if (!amount || !Number.isFinite(amount.amount)) continue;
    const divisor = Math.pow(10, Number(amount.decimalPoint) || 0);
    const total = cash.totalAmount && cash.totalAmount.amount;
    return {
      price: Math.round(amount.amount / divisor),
      totalPrice:
        total && Number.isFinite(total)
          ? Math.round(total / Math.pow(10, Number(cash.totalAmount.decimalPoint) || 0))
          : null,
      currency: amount.currency || "CNY",
      membersOnly: Boolean(rate.membersOnly),
      rateSource: rate.sourceOfRate || "",
      checkIn: raw.requestDate.checkIn,
      checkOut: raw.requestDate.checkOut
    };
  }
  return null;
}

function normalizeImageUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith("/")) return "https://cache.marriott.com" + url;
  return null;
}

const curatedByName = new Map(
  curatedDestinations.map((destination) => [destination.name, destination])
);

const seen = new Set();
const hotels = [];
const destinationHotels = new Map();

for (const edge of raw.edges) {
  const node = edge && edge.node;
  const property = node && node.property;
  const info = property && property.basicInformation;
  if (!property || !info) continue;
  if (seen.has(property.id)) continue;
  seen.add(property.id);

  const lng = Number(info.longitude);
  const lat = Number(info.latitude);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

  const province = findProvince(lng, lat);
  if (!province || !REGION_BY_PROVINCE[province.properties.name]) {
    continue;
  }
  const city = findCity(province, lng, lat);
  const cityCenterLngLat = city.center || [lng, lat];
  let curated = curatedByName.get(city.shortName);
  if (
    !curated &&
    province.properties.name === "浙江省" &&
    String(info.name || "").includes("安吉")
  ) {
    curated = curatedByName.get("安吉");
  }
  const destinationId = curated
    ? curated.id
    : "city-" + (city.adcode || province.properties.adcode);
  const destinationName = curated ? curated.name : city.shortName;
  const brandId = (info.brand && info.brand.id) || "UNKNOWN";
  const brand = BRAND_NAME_ZH[brandId] || (info.brand && info.brand.name) || "万豪系";
  const tier = brandTier(brandId);
  const rating =
    property.reviews &&
    property.reviews.stars &&
    Number.isFinite(property.reviews.stars.count)
      ? property.reviews.stars.count
      : null;
  const reviewCount =
    property.reviews &&
    property.reviews.numberOfReviews &&
    Number.isFinite(property.reviews.numberOfReviews.count)
      ? property.reviews.numberOfReviews.count
      : null;
  const adjustedRating = rating
    ? (rating * (reviewCount || 0) + 4.1 * 30) / ((reviewCount || 0) + 30)
    : null;
  const quality = adjustedRating ? Math.round(adjustedRating * 20) / 10 : 7;
  const price = priceFromRates(node.rates);
  const image =
    property.media &&
    property.media.primaryImage &&
    property.media.primaryImage.edges &&
    property.media.primaryImage.edges[0] &&
    property.media.primaryImage.edges[0].node &&
    property.media.primaryImage.edges[0].node.imageUrls;
  const caption =
    info.descriptions && info.descriptions[0] ? info.descriptions[0].text : "";

  const hotel = {
    id: property.id,
    destinationId,
    name: cleanText(info.name),
    nameEn: cleanText(info.nameInDefaultLanguage || info.name),
    brand,
    brandId,
    brandTier: tier,
    area: destinationName,
    price: price ? price.price : null,
    totalPrice: price ? price.totalPrice : null,
    priceMeta: price,
    quality,
    rating,
    reviewCount,
    mode: "unverified",
    coords: { latitude: lat, longitude: lng },
    tags: [tier, info.resort ? "度假" : "城市酒店"],
    suitable:
      tier === "奢华"
        ? ["品质度假", "情侣", "商务"]
        : tier === "高端"
          ? ["城市漫游", "商务", "亲子"]
          : ["预算平衡", "短住", "商务"],
    intro:
      (info.name || "该酒店") +
      " 位于" +
      province.shortName +
      (city.shortName ? city.shortName : "") +
      "，已收录于万豪官方公开酒店目录。" +
      (caption ? caption + " " : "") +
      "房型、会员权益、运营管理模式和实时库存需以官方确认为准。",
    highlights: [
      "万豪官方目录同步",
      rating ? "官方评分 " + rating.toFixed(1) + " / 5" : "评分待补充",
      info.newProperty ? "新开业酒店" : null,
      info.isRecentlyRenovated || info.hasRenovatedRooms ? "近期翻新" : null
    ].filter(Boolean),
    watchouts: ["运营管理模式未核实", "价格、房型与权益需以官方渠道为准"],
    sourceUrl:
      "https://www.marriott.com.cn/hotels/" +
      property.seoNickname +
      "/overview/",
    imageUrl: image ? normalizeImageUrl(image.wideHorizontal) : null,
    squareImageUrl: image ? normalizeImageUrl(image.square) : null,
    openingDate: info.openingDate || null,
    newProperty: Boolean(info.newProperty),
    bookable: Boolean(info.bookable),
    province: province.shortName,
    provinceFull: province.properties.name,
    city: city.shortName,
    cityFull: city.fullName || city.shortName,
    cityCenter: {
      latitude: cityCenterLngLat[1],
      longitude: cityCenterLngLat[0]
    },
    distanceFromCenterKm: Math.round(
      haversineKm([lng, lat], cityCenterLngLat) * 10
    ) / 10,
    region: city.region,
    source: "marriott-public-graphql",
    sourceFetchedAt: raw.fetchedAt,
    dataConfidence: "official-directory-snapshot"
  };
  hotels.push(hotel);
  if (!destinationHotels.has(destinationId)) {
    destinationHotels.set(destinationId, []);
  }
  destinationHotels.get(destinationId).push(hotel);
}

const destinationMap = new Map();
curatedDestinations.forEach((destination) => {
  destinationMap.set(destination.id, {
    ...destination,
    region:
      destination.region ||
      (destination.name === "北京"
        ? "华北"
        : destination.name === "成都"
          ? "其他"
          : "华东"),
    hotelCount: (destinationHotels.get(destination.id) || []).length
  });
});

for (const [destinationId, hotelsInCity] of destinationHotels.entries()) {
  if (destinationMap.has(destinationId)) continue;
  const sample = hotelsInCity[0];
  const avgLat =
    hotelsInCity.reduce((sum, hotel) => sum + hotel.coords.latitude, 0) /
    hotelsInCity.length;
  const avgLng =
    hotelsInCity.reduce((sum, hotel) => sum + hotel.coords.longitude, 0) /
    hotelsInCity.length;
  destinationMap.set(destinationId, {
    id: destinationId,
    name: sample.city,
    province: sample.province,
    region: sample.region,
    tagline: "万豪系酒店已覆盖",
    description:
      sample.city +
      "目前收录 " +
      hotelsInCity.length +
      " 家万豪系酒店。可查看真实位置、官方评分与当前可获取的参考房价；详细目的地内容仍可继续补充。",
    tags: ["城市漫游", "商务"],
    seasonMonths: [],
    shoulderMonths: [],
    bestWindow: "季节信息待接入",
    seasonLabel: "酒店目录可用",
    seasonConfidence: "待核验",
    walkLevel: "medium",
    foodPerDay: 220,
    localPerDay: 80,
    ticketPerPerson: 120,
    experienceType: "city",
    routes: {},
    spots: [
      {
        name: sample.city + "酒店分布",
        note: "当前可先查看酒店地图与官方目录；景点、秋色和游玩内容尚未完成逐城接入。",
        walk: "中",
        transfer: "以酒店位置为准"
      }
    ],
    itinerary: [
      {
        title: "先选酒店",
        items: ["按区域、品牌和价位筛选酒店", "到官方页面确认房型与权益"]
      }
    ],
    warnings: ["目的地内容尚未完成逐城核验", "实时库存与会员权益以官方为准"],
    rainPlan: "查看当地天气与酒店公告。",
    accent: ["amber", "moss", "pine", "clay", "pomegranate", "tea"][
      destinationMap.size % 6
    ],
    coords: sample.cityCenter || { latitude: avgLat, longitude: avgLng },
    hotelCount: hotelsInCity.length
  });
}

// Enrich the six curated destination records with average hotel coordinates.
for (const [destinationId, hotelsInCity] of destinationHotels.entries()) {
  const destination = destinationMap.get(destinationId);
  if (!destination || !hotelsInCity.length) continue;
  const useHotelAverage = destinationId === "anji";
  destination.coords = {
    latitude:
      !useHotelAverage &&
      hotelsInCity[0].cityCenter &&
      hotelsInCity[0].cityCenter.latitude
        ? hotelsInCity[0].cityCenter.latitude
        : hotelsInCity.reduce((sum, hotel) => sum + hotel.coords.latitude, 0) /
          hotelsInCity.length,
    longitude:
      !useHotelAverage &&
      hotelsInCity[0].cityCenter &&
      hotelsInCity[0].cityCenter.longitude
        ? hotelsInCity[0].cityCenter.longitude
        : hotelsInCity.reduce((sum, hotel) => sum + hotel.coords.longitude, 0) /
          hotelsInCity.length
  };
  destination.hotelCount = hotelsInCity.length;
}

const destinations = Array.from(destinationMap.values())
  .filter((destination) => destination.hotelCount > 0)
  .sort((a, b) => {
    const regionOrder = ["华东", "华南", "华北", "华中", "西南", "西北", "东北"];
    const regionDiff =
      regionOrder.indexOf(a.region) - regionOrder.indexOf(b.region);
    return regionDiff || a.name.localeCompare(b.name, "zh-CN");
  });

const regionCounts = {};
for (const hotel of hotels) {
  regionCounts[hotel.region] = (regionCounts[hotel.region] || 0) + 1;
}
const provinceCounts = {};
for (const hotel of hotels) {
  provinceCounts[hotel.province] = (provinceCounts[hotel.province] || 0) + 1;
}

const catalog = {
  generatedAt: new Date().toISOString(),
  source: "Marriott public hotel search GraphQL",
  sourceCheckedAt: raw.fetchedAt,
  priceSnapshot: raw.requestDate,
  rawMatchCount: raw.uniqueCount,
  hotelCount: hotels.length,
  destinationCount: destinations.length,
  regionCounts,
  provinceCounts,
  hotels,
  destinations
};

fs.writeFileSync(outputJson, JSON.stringify(catalog, null, 2));
fs.writeFileSync(
  outputJs,
  "(function (global) {\n" +
    '  "use strict";\n' +
    "  global.APP_CATALOG = " +
    JSON.stringify(catalog) +
    ";\n" +
    '})(typeof window !== "undefined" ? window : globalThis);\n'
);

console.log(
  JSON.stringify(
    {
      outputJson,
      outputJs,
      hotelCount: hotels.length,
      destinationCount: destinations.length,
      regionCounts,
      topProvinces: Object.entries(provinceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
    },
    null,
    2
  )
);
