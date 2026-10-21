(function (global) {
  "use strict";

  const catalog = global.APP_CATALOG || {
    hotels: [],
    destinations: [],
    generatedAt: null,
    sourceCheckedAt: null,
    priceSnapshot: null
  };
  const priceOverrides = global.APP_PRICE_OVERRIDES || {
    hotels: {}
  };

  const MANAGEMENT_MODES = {
    managed: "万豪直管",
    franchise: "特许经营",
    thirdParty: "第三方管理",
    other: "其他模式",
    unverified: "未核实"
  };

  const PRICE_BANDS = [
    { id: "all", label: "全部价位", min: 0, max: Infinity },
    { id: "under500", label: "¥500 以下", min: 0, max: 500 },
    { id: "500to900", label: "¥501–900", min: 501, max: 900 },
    { id: "900to1500", label: "¥901–1,500", min: 901, max: 1500 },
    { id: "1500to2500", label: "¥1,501–2,500", min: 1501, max: 2500 },
    { id: "over2500", label: "¥2,500 以上", min: 2501, max: Infinity }
  ];

  const REVIEW_SOURCES = [
    { id: "ota", label: "平台住客评价", short: "平台评价", weight: 1 },
    { id: "fliggy", label: "飞猪公开住客评价", short: "飞猪评价", weight: 1 },
    { id: "ctrip", label: "携程公开住客评价", short: "携程评价", weight: 1 },
    { id: "xhs", label: "小红书公开体验帖", short: "小红书", weight: 0.7 },
    { id: "xhs_post", label: "社交平台主帖", short: "社交主帖", weight: 0.7 },
    { id: "xhs_comment", label: "社交平台评论区", short: "评论区", weight: 0.55 },
    { id: "manual", label: "其他主动导入", short: "主动导入", weight: 0.45 }
  ];

  const REGIONS = ["全国", "华东", "华南", "华北", "华中", "西南", "西北", "东北"];
  const SOUTHWEST_PROVINCES = new Set(["重庆", "四川", "贵州", "云南", "西藏"]);
  const NORTHWEST_PROVINCES = new Set(["陕西", "甘肃", "青海", "宁夏", "新疆"]);
  const regionForProvince = (province, fallback) => {
    const value = cleanText(province)
      .replace(/壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区|省|市/g, "");
    if (SOUTHWEST_PROVINCES.has(value)) return "西南";
    if (NORTHWEST_PROVINCES.has(value)) return "西北";
    return fallback || "其他";
  };
  const cleanText = (value) =>
    String(value || "")
      .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, "")
      .trim();
  const normalizedDestinations = (catalog.destinations || []).map((destination) =>
    Object.assign({}, destination, {
      region: regionForProvince(destination.province, destination.region)
    })
  );
  const destinationsById = new Map(
    normalizedDestinations.map((destination) => [destination.id, destination])
  );
  const catalogHotels = (catalog.hotels || []).map((hotel) => {
    const destination = destinationsById.get(hotel.destinationId);
    const withRegion = Object.assign({}, hotel, {
      region: regionForProvince(
        hotel.province,
        destination ? destination.region : hotel.region
      )
    });
    const override = priceOverrides.hotels && priceOverrides.hotels[hotel.id];
    if (!override || !(Number(override.price) > 0)) return withRegion;
    return Object.assign({}, withRegion, {
      price: Number(override.price),
      priceMeta: {
        checkIn: override.checkIn,
        checkOut: override.checkOut,
        currency: "CNY",
        source: override.source,
        sourceLabel: "飞猪实时起价",
        fetchedAt: override.fetchedAt
      },
      bookingUrl: override.detailUrl || hotel.bookingUrl || "",
      flyAiShid: override.shid || hotel.flyAiShid || "",
      imageUrl: hotel.imageUrl || override.imageUrl || null,
      squareImageUrl: hotel.squareImageUrl || override.imageUrl || null
    });
  });
  const normalizedHotels = catalogHotels.map((hotel) => {
    const rating = Number(hotel.rating);
    const reviewCount = Number(hotel.reviewCount) || 0;
    const cleaned = Object.assign({}, hotel, {
      name: cleanText(hotel.name),
      nameEn: cleanText(hotel.nameEn),
      brand: cleanText(hotel.brand)
    });
    if (!Number.isFinite(rating)) return cleaned;
    const adjustedRating =
      (rating * reviewCount + 4.1 * 30) / (reviewCount + 30);
    return Object.assign(cleaned, {
      quality: Math.round(adjustedRating * 20) / 10
    });
  });

  global.APP_DATA = {
    version: "0.8.0",
    dataMode: "万豪官方公开酒店目录快照；部分价格为指定日期公开报价",
    updatedAt: catalog.sourceCheckedAt || catalog.generatedAt,
    managementModes: MANAGEMENT_MODES,
    priceBands: PRICE_BANDS,
    reviewSources: REVIEW_SOURCES,
    regions: REGIONS,
    destinations: normalizedDestinations,
    hotels: normalizedHotels,
    catalogMeta: {
      generatedAt: catalog.generatedAt,
      sourceCheckedAt: catalog.sourceCheckedAt,
      priceSnapshot: catalog.priceSnapshot,
      rawMatchCount: catalog.rawMatchCount,
      hotelCount: catalog.hotelCount,
      destinationCount: catalog.destinationCount,
      regionCounts: normalizedHotels.reduce((counts, hotel) => {
        counts[hotel.region] = (counts[hotel.region] || 0) + 1;
        return counts;
      }, {}),
      source: catalog.source
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
