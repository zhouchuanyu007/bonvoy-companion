(function () {
  "use strict";

  const DATA = window.APP_DATA;
  const LOGIC = window.APP_LOGIC;
  let BUNDLED_HOTEL_INSIGHTS = window.APP_HOTEL_INSIGHTS || {
    hotels: {}
  };
  const BUNDLED_POINTS_PROMOTIONS = window.APP_POINTS_PROMOTIONS || {
    hotels: {}
  };

  const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
  const DEFAULT_QUERY = "十一月想去看秋色，有万豪酒店，预算 5000，少走路";
  const AMAP_KEY =
    (window.AndroidConfig &&
    typeof window.AndroidConfig.getAmapKey === "function"
      ? window.AndroidConfig.getAmapKey()
      : "") ||
    window.BONVOY_AMAP_KEY ||
    "";
  const KEYLESS_BUILD = Boolean(
    window.AndroidConfig &&
      typeof window.AndroidConfig.isKeylessBuild === "function" &&
      window.AndroidConfig.isKeylessBuild()
  );
  const MAP_ADDRESS_RADIUS_KM = 12;
  const HOTEL_INSIGHTS_SCRIPT = "hotel-insights.js?v=0.12.1-performance-1";
  const DEFAULT_PREFS = {
    departure: "上海",
    month: 11,
    days: 3,
    people: 2,
    rooms: 1,
    budget: 5000,
    styles: ["赏秋"],
    lowWalking: true,
    travelStyle: "balanced"
  };
  const QUICK_QUERIES = [
    { label: "赏秋", query: "十一月赏秋，要有万豪酒店，少走路" },
    { label: "亲子轻松", query: "带孩子轻松玩三天，有万豪，少走路" },
    { label: "城市美食", query: "想吃得好，也想城市漫游，有万豪酒店" },
    { label: "山林度假", query: "想去山里住两晚，有万豪酒店，不赶路" }
  ];
  const PLANNER_INTERESTS = [
    {
      id: "autumn",
      label: "赏秋",
      keyword: "公园",
      flyaiCategory: "自然风光"
    },
    {
      id: "city",
      label: "城市漫游",
      keyword: "景点",
      flyaiCategory: "城市观光"
    },
    {
      id: "nature",
      label: "自然风光",
      keyword: "风景名胜",
      flyaiCategory: "自然风光"
    },
    {
      id: "history",
      label: "历史人文",
      keyword: "博物馆",
      flyaiCategory: "历史古迹"
    },
    {
      id: "family",
      label: "亲子",
      keyword: "亲子乐园",
      flyaiCategory: "主题乐园"
    },
    {
      id: "food",
      label: "美食",
      keyword: "美食",
      flyaiCategory: "市集"
    }
  ];
  const MAP_BANDS = [
    { id: "all", label: "全部价位", test: () => true },
    {
      id: "budget",
      label: "¥900 以内",
      test: (hotel) => Number.isFinite(Number(hotel.price)) && hotel.price <= 900
    },
    {
      id: "mid",
      label: "¥901–1,500",
      test: (hotel) =>
        Number.isFinite(Number(hotel.price)) &&
        hotel.price >= 901 &&
        hotel.price <= 1500
    },
    {
      id: "luxury",
      label: "¥1,500 以上",
      test: (hotel) => Number.isFinite(Number(hotel.price)) && hotel.price > 1500
    }
  ];
  const CHECKLIST_ITEMS = [
    {
      id: "cancellation",
      title: "核对免费取消截止时间",
      detail: "把日期写进行程卡，避免临近入住才发现不可退。"
    },
    {
      id: "room",
      title: "确认床型、人数和加床",
      detail: "尤其是亲子、三人入住或需要双床的订单。"
    },
    {
      id: "late",
      title: "确认晚到与保留房间",
      detail: "晚班机、晚高铁或自驾堵车时提前联系酒店。"
    },
    {
      id: "benefits",
      title: "确认早餐、酒廊和会员权益",
      detail: "以官方规则和酒店当日执行为准，不依赖未核验的住客经验。"
    },
    {
      id: "transport",
      title: "复核最后一公里",
      detail: "看地铁出口、步行路面、接驳车时刻和停车入口。"
    },
    {
      id: "invoice",
      title: "保存发票与报销信息",
      detail: "商务出行提前核对抬头、税号和开票方式。"
    }
  ];

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
    ER: "万豪行政公寓",
    BA: "万豪旅享家公寓",
    BU: "宝格丽",
    SE: "Series by Marriott",
    CM: "citizenM",
    XE: "City Express"
  };
  const FLYAI_BRANDS = [
    { id: "RZ", name: "丽思卡尔顿", tier: "奢华", patterns: ["丽思卡尔顿", "Ritz-Carlton"] },
    { id: "XR", name: "瑞吉", tier: "奢华", patterns: ["瑞吉", "St. Regis"] },
    { id: "EB", name: "艾迪逊", tier: "奢华", patterns: ["艾迪逊", "Edition"] },
    {
      id: "LC",
      name: "豪华精选",
      tier: "奢华",
      patterns: ["豪华精选", "Luxury Collection"]
    },
    { id: "WH", name: "W 酒店", tier: "奢华", patterns: ["W酒店", "W 酒店", "W Hotel"] },
    { id: "JW", name: "JW 万豪", tier: "奢华", patterns: ["JW万豪", "JW 万豪", "JW Marriott"] },
    { id: "CY", name: "万怡", tier: "精选", patterns: ["万怡", "Courtyard"] },
    { id: "FP", name: "福朋喜来登", tier: "精选", patterns: ["福朋喜来登", "福朋", "Four Points"] },
    { id: "FI", name: "万枫", tier: "精选", patterns: ["万枫", "Fairfield"] },
    { id: "AR", name: "AC 酒店", tier: "精选", patterns: ["AC酒店", "AC 酒店", "AC Hotel"] },
    { id: "AL", name: "雅乐轩", tier: "精选", patterns: ["雅乐轩", "Aloft"] },
    { id: "OX", name: "Moxy", tier: "精选", patterns: ["Moxy", "MOXY"] },
    { id: "EL", name: "源宿", tier: "精选", patterns: ["源宿", "Element"] },
    { id: "SI", name: "喜来登", tier: "高端", patterns: ["喜来登", "Sheraton"] },
    { id: "WI", name: "威斯汀", tier: "高端", patterns: ["威斯汀", "Westin"] },
    { id: "MD", name: "艾美", tier: "高端", patterns: ["艾美", "Le Méridien", "Le Meridien"] },
    { id: "BR", name: "万丽", tier: "高端", patterns: ["万丽", "Renaissance"] },
    { id: "AK", name: "傲途格精选", tier: "高端", patterns: ["傲途格", "Autograph"] },
    { id: "DE", name: "德尔塔", tier: "高端", patterns: ["德尔塔", "Delta"] },
    { id: "TX", name: "臻品之选", tier: "高端", patterns: ["臻品之选", "Tribute"] },
    { id: "MC", name: "万豪", tier: "高端", patterns: ["万豪", "Marriott"] }
  ];

  const ICONS = {
    brand:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#F6F3EC" d="M12 2.2 20.1 12 12 21.8 3.9 12 12 2.2Z"/><path fill="#B99456" d="m12 7 4 5-4 5-4-5 4-5Z"/><path fill="#0F2843" d="M10.8 10.2h2.4V15h-2.4zM9.6 12h4.8v1.3H9.6z"/></svg>',
    search:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.8" cy="10.8" r="6.4"/><path d="m15.6 15.6 4.1 4.1"/></svg>',
    arrowRight:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13"/><path d="m13 7 5 5-5 5"/></svg>',
    arrowLeft:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H6"/><path d="m11 17-5-5 5-5"/></svg>',
    settings:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.2 13.2a7.6 7.6 0 0 0 0-2.4l2-1.5-2-3.4-2.3 1a8 8 0 0 0-2.1-1.2L14.6 3h-4l-.3 2.6a8 8 0 0 0-2 1.2L6 5.9 4 9.3l2 1.5a7.6 7.6 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 2 1.2l.4 2.7h4l.3-2.7a8 8 0 0 0 2-1.2l2.2 1 2-3.4-2-1.5Z"/></svg>',
    compass:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m15.8 8.2-2.2 5.4-5.4 2.2 2.2-5.4 5.4-2.2Z"/></svg>',
    map:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 6.3 5.3-2 6.4 2 5.3-2v13.4l-5.3 2-6.4-2-5.3 2V6.3Z"/><path d="M8.8 4.3v13.4M15.2 6.3v13.4"/></svg>',
    locate:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/><circle cx="12" cy="12" r="7"/></svg>',
    chart:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    bookmark:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.8h12v17L12 17l-6 3.8v-17Z"/></svg>',
    heart:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M20.6 5.6a5 5 0 0 0-7.1 0L12 7.1l-1.5-1.5a5 5 0 0 0-7.1 7.1L12 21l8.6-8.3a5 5 0 0 0 0-7.1Z"/></svg>',
    heartFill:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.6 5.6a5 5 0 0 0-7.1 0L12 7.1l-1.5-1.5a5 5 0 0 0-7.1 7.1L12 21l8.6-8.3a5 5 0 0 0 0-7.1Z"/></svg>',
    compare:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M8 5H4v14h4M16 5h4v14h-4M9 9h6M12 6v12"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    walk:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4.2" r="1.8"/><path d="m10.5 20 2-5.5-2.7-2.4L8.3 16M12.5 14.5l3.2 5.5M11.2 8.3l3.3.9 2 3.1M11.2 8.3l-3 3.2-2.5.4"/></svg>',
    info:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 10.5v6M12 7.5h.01"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.2 4.2L19 7"/></svg>',
    plus:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    external:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg>',
    calculator:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></svg>',
    spark:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></svg>',
    alert:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v4.5M12 17h.01"/></svg>',
    source:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h7v14H4zM13 5h7v14h-7z"/><path d="M7 8h1M7 11h1M16 8h1M16 11h1"/></svg>',
    building:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 21V5h10v16M15 10h4v11M2 21h20"/><path d="M8 8h.01M11 8h.01M8 12h.01M11 12h.01M8 16h.01M11 16h.01"/></svg>',
    wallet:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19v16H6.5A2.5 2.5 0 0 1 4 17.5v-11Z"/><path d="M4 8h15M15 12h5v4h-5a2 2 0 0 1 0-4Z"/></svg>',
    ticket:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V6Z"/><path d="M12 7.5v9"/></svg>'
  };

  function safeRead(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function safeWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // The app remains usable if WebView storage is unavailable.
    }
  }

  function qualityFromRating(rating, reviewCount) {
    if (!Number.isFinite(Number(rating))) return 7;
    const count = Number(reviewCount) || 0;
    const adjustedRating =
      (Number(rating) * count + 4.1 * 30) / (count + 30);
    return Math.round(adjustedRating * 20) / 10;
  }

  function cleanHotelText(value) {
    return String(value || "")
      .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, "")
      .trim();
  }

  function brandTierFromId(brandId) {
    if (["RZ", "XR", "EB", "LC", "WH", "JW", "BU"].includes(brandId)) return "奢华";
    if (
      ["MC", "SI", "DE", "MD", "WI", "AK", "DS", "BR", "TX", "ER", "BA"].includes(
        brandId
      )
    ) {
      return "高端";
    }
    return "精选";
  }

  function persistLiveHotelCache() {
    safeWrite("lvban.liveHotelCache.v2", liveHotelCache);
  }

  function applyLiveHotelPayload(payload, remember) {
    const destination = LOGIC.getDestination(payload.destinationId);
    if (!destination) {
      throw new Error("同步结果对应的城市不存在");
    }
    let updated = 0;
    let added = 0;
    let priced = 0;
    let pointsPriced = 0;
    (payload.hotels || []).forEach((item) => {
      if (!item || !item.id || !Number.isFinite(Number(item.latitude))) return;
      const hasLivePrice = Number.isFinite(Number(item.price)) && Number(item.price) > 0;
      if (hasLivePrice) priced += 1;
      if (Number(item.pointsPrice) > 0) pointsPriced += 1;
      const existing = LOGIC.getHotel(item.id);
      if (existing) {
        existing.price = hasLivePrice ? Number(item.price) : null;
        existing.totalPrice = hasLivePrice ? Number(item.totalPrice) : null;
        if (
          Number.isFinite(Number(item.pointsPrice)) &&
          Number(item.pointsPrice) > 0
        ) {
          existing.pointsPrice = Number(item.pointsPrice);
          existing.pointsMeta = {
            checkIn: payload.checkIn,
            checkOut: payload.checkOut,
            source: "Marriott official points rate"
          };
        }
        const officialPromotion = normalizePointsPromotion(
          item.pointsPromotion ||
            item.bonusPointsPromotion ||
            item.promotion,
          "万豪官方实时返回"
        );
        if (officialPromotion) {
          existing.pointsPromotion = officialPromotion;
        }
        existing.priceMeta = hasLivePrice
          ? {
              checkIn: payload.checkIn,
              checkOut: payload.checkOut,
              currency: item.currency || "CNY",
              source: "Marriott official live query"
            }
          : null;
        existing.rating = Number.isFinite(Number(item.rating))
          ? Number(item.rating)
          : existing.rating;
        existing.reviewCount = Number.isFinite(Number(item.reviewCount))
          ? Number(item.reviewCount)
          : existing.reviewCount;
        existing.quality = qualityFromRating(
          existing.rating || existing.quality / 2,
          existing.reviewCount
        );
        existing.bookable = Boolean(item.bookable);
        existing.openingDate = item.openingDate || existing.openingDate;
        existing.newProperty = Boolean(item.newProperty);
        if (item.seoNickname) {
          existing.sourceUrl =
            "https://www.marriott.com.cn/hotels/" +
            item.seoNickname +
            "/overview/";
        }
        existing.lastLiveSyncAt = new Date().toISOString();
        if (remember) {
          liveHotelCache[existing.id] = {
            destinationId: existing.destinationId,
            savedAt: new Date().toISOString(),
            hotel: existing
          };
        }
        updated += 1;
        return;
      }

      const insideCity =
        (Number.isFinite(Number(item.distance)) && Number(item.distance) <= 30000) ||
        String(item.name || "").includes(destination.name);
      if (!insideCity) return;
      const brandId = item.brandId || "";
      const brand = BRAND_NAME_ZH[brandId] || item.brandName || "万豪系";
      const tier = brandTierFromId(brandId);
      const hotel = {
        id: item.id,
        destinationId: destination.id,
        name: cleanHotelText(item.name),
        nameEn: cleanHotelText(item.nameEn || item.name),
        brand,
        brandId,
        brandTier: tier,
        area: destination.name,
        price: hasLivePrice ? Number(item.price) : null,
        totalPrice: hasLivePrice ? Number(item.totalPrice) : null,
        pointsPrice:
          Number.isFinite(Number(item.pointsPrice)) &&
          Number(item.pointsPrice) > 0
            ? Number(item.pointsPrice)
            : null,
        pointsMeta:
          Number.isFinite(Number(item.pointsPrice)) &&
          Number(item.pointsPrice) > 0
            ? {
                checkIn: payload.checkIn,
                checkOut: payload.checkOut,
                source: "Marriott official points rate"
              }
            : null,
        priceMeta: hasLivePrice
          ? {
              checkIn: payload.checkIn,
              checkOut: payload.checkOut,
              currency: item.currency || "CNY",
              source: "Marriott official live query"
            }
          : null,
        quality: qualityFromRating(item.rating, item.reviewCount),
        rating: Number.isFinite(Number(item.rating)) ? Number(item.rating) : null,
        reviewCount: Number.isFinite(Number(item.reviewCount))
          ? Number(item.reviewCount)
          : null,
        mode: "unverified",
        coords: {
          latitude: Number(item.latitude),
          longitude: Number(item.longitude)
        },
        tags: [tier, "官方目录更新"],
        suitable: ["城市漫游", "商务", "短住"],
        intro:
          (item.name || "该酒店") +
          " 已通过万豪官方公开目录更新。房型、会员权益、运营管理模式和实时库存需以官方确认为准。",
        highlights: ["来自官方实时查询", "坐标与价格快照已更新"],
        watchouts: ["价格与权益需以官方确认为准"],
        sourceUrl: item.seoNickname
          ? "https://www.marriott.com.cn/hotels/" +
            item.seoNickname +
            "/overview/"
          : "https://www.marriott.com.cn/",
        imageUrl: null,
        squareImageUrl: null,
        openingDate: item.openingDate || null,
        newProperty: Boolean(item.newProperty),
        bookable: Boolean(item.bookable),
        province: destination.province,
        provinceFull: destination.province,
        city: destination.name,
        cityFull: destination.name,
        region: destination.region,
        source: "marriott-official-live",
        sourceFetchedAt: new Date().toISOString(),
        dataConfidence: "official-live-query"
      };
      DATA.hotels.push(hotel);
      destination.hotelCount = LOGIC.hotelsFor(destination.id).length;
      if (remember) {
        liveHotelCache[hotel.id] = {
          destinationId: destination.id,
          savedAt: new Date().toISOString(),
          hotel
        };
      }
      added += 1;
    });
    persistLiveHotelCache();
    DATA.catalogMeta.lastLiveSyncAt = new Date().toISOString();
    return {
      updated,
      added,
      priced,
      pointsPriced,
      total: (payload.hotels || []).length
    };
  }

  function hydrateLiveHotelCache() {
    const entries = Object.values(liveHotelCache || {});
    if (!entries.length) return;
    let changed = false;
    entries.forEach((entry) => {
      if (!entry || !entry.hotel || !entry.destinationId) return;
      const destination = LOGIC.getDestination(entry.destinationId);
      if (!destination) return;
      const existing = LOGIC.getHotel(entry.hotel.id);
      if (existing) {
        Object.assign(existing, entry.hotel);
      } else {
        entry.hotel.destinationId = destination.id;
        DATA.hotels.push(entry.hotel);
      }
      destination.hotelCount = LOGIC.hotelsFor(destination.id).length;
      changed = true;
    });
    if (changed) {
      DATA.catalogMeta.lastLiveSyncAt = new Date().toISOString();
    }
  }

  function normalizeHotelKey(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[\s·,，。()（）\-—_/]/g, "")
      .replace(/大酒店|度假酒店|酒店|宾馆|饭店/g, "");
  }

  function flyAiBrandFromName(name) {
    const value = String(name || "").toLowerCase();
    const match = FLYAI_BRANDS.find((brand) =>
      brand.patterns.some((pattern) => value.includes(pattern.toLowerCase()))
    );
    return (
      match || {
        id: "",
        name: "万豪系",
        tier: "精选"
      }
    );
  }

  function findFlyAiHotelMatch(destinationId, name) {
    const key = normalizeHotelKey(name);
    if (!key) return null;
    const hotels = LOGIC.hotelsFor(destinationId);
    const exact = hotels.find((hotel) => normalizeHotelKey(hotel.name) === key);
    if (exact) return exact;
    const partial = hotels
      .filter((hotel) => {
        const local = normalizeHotelKey(hotel.name);
        return (
          key.length >= 6 &&
          local.length >= 6 &&
          (local.includes(key) || key.includes(local))
        );
      })
      .sort(
        (a, b) =>
          Math.abs(normalizeHotelKey(a.name).length - key.length) -
          Math.abs(normalizeHotelKey(b.name).length - key.length)
      );
    return partial[0] || null;
  }

  function parseFlyAiPrice(value) {
    const match = String(value || "")
      .replace(/,/g, "")
      .match(/\d+(?:\.\d+)?/);
    const price = match ? Number(match[0]) : NaN;
    return Number.isFinite(price) && price > 0 ? price : null;
  }

  function getFlyAiItems(payload) {
    if (!payload) return [];
    if (payload.data && Array.isArray(payload.data.itemList)) {
      return payload.data.itemList;
    }
    return Array.isArray(payload.itemList) ? payload.itemList : [];
  }

  function persistFlyAiHotelCache() {
    safeWrite("lvban.flyaiHotelCache.v3", flyAiHotelCache);
  }

  function mergeFlyAiHotelResults(destination, payload, checkIn, checkOut) {
    const items = getFlyAiItems(payload);
    const fetchedAt = new Date().toISOString();
    let updated = 0;
    let added = 0;
    let priced = 0;
    items.forEach((item) => {
      const name = cleanHotelText(item && item.name);
      const latitude = Number(item && item.latitude);
      const longitude = Number(item && item.longitude);
      if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }
      const price = parseFlyAiPrice(item.price);
      if (!price) return;
      let hotel = findFlyAiHotelMatch(destination.id, name);
      if (!hotel) {
        const brand = flyAiBrandFromName(name);
        const stableId =
          "flyai-" +
          String(item.shid || name)
            .toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-");
        if (LOGIC.getHotel(stableId)) {
          hotel = LOGIC.getHotel(stableId);
        } else {
          hotel = {
            id: stableId,
            destinationId: destination.id,
            name,
            nameEn: name,
            brand: brand.name,
            brandId: brand.id,
            brandTier: brand.tier,
            area: item.nearbyPoi || destination.name,
            price,
            totalPrice: null,
            quality: 0,
            rating: null,
            reviewCount: null,
            mode: "unverified",
            coords: {
              latitude,
              longitude
            },
            tags: [brand.tier, "飞猪联网补充"],
            suitable: ["城市漫游", "短住"],
            intro:
              name +
              " 来自飞猪实时酒店搜索。该记录用于补充本地快照，尚未取得可核验的住客评论全文、管理模式或会员权益承诺。",
            highlights: ["飞猪实时返回酒店", "可查看当日房型与预订页"],
            watchouts: ["管理模式待核实", "房价为起价，税费与房型以下单页为准"],
            sourceUrl: "https://www.marriott.com.cn/",
            bookingUrl: item.detailUrl || null,
            imageUrl: item.mainPic || null,
            squareImageUrl: item.mainPic || null,
            province: destination.province,
            provinceFull: destination.province,
            city: destination.name,
            cityFull: destination.name,
            region: destination.region,
            source: "fliggy-live-catalog",
            sourceFetchedAt: fetchedAt,
            dataConfidence: "partner-live-search"
          };
          DATA.hotels.push(hotel);
          added += 1;
        }
      } else {
        updated += 1;
      }
      if (!hotel) return;
      priced += 1;
      hotel.price = price;
      hotel.priceMeta = {
        checkIn,
        checkOut,
        currency: "CNY",
        source: "Fliggy live starting price",
        sourceLabel: "飞猪实时起价",
        fetchedAt
      };
      hotel.flyAiShid = item.shid || hotel.flyAiShid || "";
      hotel.flyAiSystemMessage =
        payload.systemMessage || hotel.flyAiSystemMessage || "";
      hotel.flyAiReviewSnippet =
        item.review || hotel.flyAiReviewSnippet || "";
      hotel.bookingUrl = item.detailUrl || hotel.bookingUrl || "";
      hotel.flyAiDetailUrl = item.detailUrl || hotel.flyAiDetailUrl || "";
      hotel.imageUrl = item.mainPic || hotel.imageUrl || null;
      hotel.squareImageUrl =
        item.mainPic || hotel.squareImageUrl || hotel.imageUrl || null;
      hotel.nearbyPoi = item.nearbyPoi || hotel.nearbyPoi || "";
      hotel.starLabel = item.star || hotel.starLabel || "";
      hotel.lastRenovation = item.decorationTime || hotel.lastRenovation || "";
      const pointsPromotion = pointsPromotionFromFlyAiItem(item);
      if (pointsPromotion) {
        hotel.pointsPromotion = pointsPromotion;
      }
      hotel.flyAiScore = Number(item.score || item.rate) || hotel.flyAiScore || null;
      hotel.lastLiveSyncAt = fetchedAt;
      hotel.priceUpdatedAt = fetchedAt;
      if (
        hotel.coords &&
        Number.isFinite(Number(hotel.coords.latitude)) &&
        Number.isFinite(Number(hotel.coords.longitude)) &&
        destination.coords &&
        Number.isFinite(Number(destination.coords.latitude)) &&
        Number.isFinite(Number(destination.coords.longitude))
      ) {
        hotel.distanceFromCenterKm =
          hotel.distanceFromCenterKm ||
          plannerStraightLineKm(
            [destination.coords.longitude, destination.coords.latitude],
            [hotel.coords.longitude, hotel.coords.latitude]
          );
      }
      destination.hotelCount = LOGIC.hotelsFor(destination.id).length;
      flyAiHotelCache[hotel.id] = {
        savedAt: fetchedAt,
        destinationId: destination.id,
        hotel: Object.assign({}, hotel)
      };
    });
    persistFlyAiHotelCache();
    DATA.catalogMeta.lastLiveSyncAt = fetchedAt;
    return {
      total: items.length,
      priced,
      updated,
      added,
      systemMessage: payload.systemMessage || ""
    };
  }

  function hydrateFlyAiHotelCache() {
    const entries = Object.values(flyAiHotelCache || {});
    if (!entries.length) return;
    entries.forEach((entry) => {
      if (!entry || !entry.hotel || !entry.destinationId) return;
      const destination = LOGIC.getDestination(entry.destinationId);
      if (!destination) return;
      const existing = LOGIC.getHotel(entry.hotel.id);
      if (existing) {
        Object.assign(existing, entry.hotel);
      } else {
        entry.hotel.destinationId = destination.id;
        DATA.hotels.push(entry.hotel);
      }
      destination.hotelCount = LOGIC.hotelsFor(destination.id).length;
    });
  }

  function persistHotelInsightCache() {
    const bundled = BUNDLED_HOTEL_INSIGHTS.hotels || {};
    const dynamic = {};
    Object.entries(hotelInsightCache).forEach(([id, entry]) => {
      if (
        !bundled[id] ||
        String(bundled[id].fetchedAt || "") !==
          String((entry && entry.fetchedAt) || "")
      ) {
        dynamic[id] = entry;
      }
    });
    safeWrite("lvban.hotelInsightCache.v1", dynamic);
  }

  function splitInsightNearby(value, limit) {
    return String(value || "")
      .split(/[;；]/)
      .map(cleanHotelText)
      .filter(Boolean)
      .slice(0, limit);
  }

  function compactFlyAiHotelInsight(hotel, items, fetchedAt) {
    const firstItem = items.find(
      (item) =>
        item &&
        item.hotelInfo &&
        item.hotelInfo["酒店基础信息"]
    );
    if (!firstItem) return null;
    const info = firstItem.hotelInfo || {};
    const basics = info["酒店基础信息"] || {};
    const policies = info["酒店政策"] || {};
    const nearby = info["酒店周边"] || {};
    const reviews = [];
    const seen = new Set();
    items.forEach((item) => {
      (item.reviews || []).forEach((review) => {
        const content = cleanHotelText(review && review.content);
        const key = content.toLowerCase();
        if (content.length < 8 || seen.has(key) || reviews.length >= 10) return;
        seen.add(key);
        reviews.push({
          source: "fliggy",
          content,
          fetchedAt
        });
      });
    });
    const rooms = (firstItem.roomLayers || [])
      .map((room) => {
        const rates = (room.rateLayers || [])
          .map((rate) => ({
            price: parseFlyAiPrice(rate["最终价格"]),
            occupancy: cleanHotelText(rate["其他政策"]),
            breakfast: cleanHotelText(rate["早餐政策"]),
            policy: cleanHotelText(rate["商品信息"])
          }))
          .filter((rate) => rate.price)
          .sort((a, b) => a.price - b.price);
        return {
          name: cleanHotelText(room.name),
          bed: cleanHotelText(room["床政策"]),
          sizeAndFloor: cleanHotelText(room["热门设施"]),
          facilities: cleanHotelText(room["其他设施"]).slice(0, 1800),
          rates: rates.slice(0, 3)
        };
      })
      .filter((room) => room.name)
      .slice(0, 12);
    return {
      hotelId: hotel.id,
      hotelName: cleanHotelText(basics["酒店名称"] || hotel.name),
      fetchedAt,
      detailUrl: firstItem.detailUrl || hotel.flyAiDetailUrl || "",
      basics: {
        address: cleanHotelText(basics["酒店地址"]),
        level: cleanHotelText(basics["酒店等级"]),
        phone: cleanHotelText(basics["酒店联系电话"]),
        rooms: cleanHotelText(basics["房间数量"]),
        opening: cleanHotelText(basics["开业时间"]),
        renovation: cleanHotelText(basics["装修时间"]),
        checkIn: cleanHotelText(basics["入住方式"]),
        business: cleanHotelText(basics["商务出行"]).slice(0, 600),
        pool: cleanHotelText(basics["恒温泳池"]),
        guests: cleanHotelText(basics["可接待人群"])
      },
      policies: {
        checkInOut: cleanHotelText(policies["入离政策"]),
        breakfast: cleanHotelText(policies["早餐政策"]),
        children: cleanHotelText(policies["儿童政策"]),
        pets: cleanHotelText(policies["宠物政策"]),
        deposit: cleanHotelText(policies["押金政策"]),
        extraBed: cleanHotelText(policies["加床费用"]),
        toiletries: cleanHotelText(policies["洗漱用品政策"])
      },
      facilities: info["酒店设施"] || {},
      nearby: {
        transport: splitInsightNearby(nearby["交通"], 8),
        attractions: splitInsightNearby(nearby["景点"], 10),
        food: splitInsightNearby(nearby["美食"], 8),
        shopping: splitInsightNearby(nearby["购物"], 8)
      },
      rooms,
      reviews
    };
  }

  function mergeHotelInsightItems(hotel, payloads, fetchedAt) {
    const items = payloads
      .flatMap((payload) => getFlyAiItems(payload))
      .filter(Boolean);
    const compact = compactFlyAiHotelInsight(hotel, items, fetchedAt);
    if (!compact) {
      throw new Error("飞猪未返回这家酒店的设施或评论详情");
    }
    hotelInsightCache[hotel.id] = compact;
    persistHotelInsightCache();
    hotel.flyAiDetailUrl =
      compact.detailUrl || hotel.flyAiDetailUrl || "";
    hotel.insightFetchedAt = fetchedAt;
    return compact;
  }

  async function loadHotelInsight(hotelId, options) {
    const hotel = LOGIC.getHotel(hotelId);
    if (!hotel) return null;
    const force = Boolean(options && options.force);
    if (!force && hotelInsightCache[hotel.id]) {
      return hotelInsightCache[hotel.id];
    }
    if (!hasFlyAiBridge()) {
      throw new Error("酒店设施与真实评价联网仅在 Android App 中可用");
    }
    await loadHotelInsightsBundle();
    if (!force && hotelInsightCache[hotel.id]) {
      return hotelInsightCache[hotel.id];
    }
    if (state.hotelInsightLoadingId === hotel.id) {
      return hotelInsightCache[hotel.id] || null;
    }
    state.hotelInsightLoadingId = hotel.id;
    state.hotelInsightError = "";
    render();
    const payloads = [];
    try {
      for (const keyword of ["服务", "设施"]) {
        const payload = await requestFlyAiWithRetry(
          "get_marriott_hotel_info",
          {
            hotelName: hotel.name,
            reviewKeyword: keyword
          },
          2
        );
        payloads.push(payload);
      }
      const fetchedAt = new Date().toISOString();
      const insight = mergeHotelInsightItems(hotel, payloads, fetchedAt);
      state.hotelInsightLoadingId = null;
      const scrollY = window.scrollY;
      render();
      window.scrollTo(0, scrollY);
      showToast("酒店设施、房价与公开评论已保存到本机");
      return insight;
    } catch (error) {
      state.hotelInsightLoadingId = null;
      state.hotelInsightError =
        error && error.message ? error.message : "酒店详情获取失败";
      const scrollY = window.scrollY;
      render();
      window.scrollTo(0, scrollY);
      throw error;
    }
  }

  function requestCityHotelSync(destinationId) {
    const destination = LOGIC.getDestination(destinationId);
    if (!destination) {
      showToast("找不到这个城市");
      return;
    }
    if (
      !window.AndroidHotelSync ||
      typeof window.AndroidHotelSync.requestCitySync !== "function"
    ) {
      state.sync = {
        status: "error",
        message: "联网更新仅在安装后的 Android App 中可用。浏览器预览不连接官方站。",
        updatedAt: null
      };
      render();
      showToast("请在 Android App 内使用联网更新");
      return;
    }
    if (!destination.coords || !Number.isFinite(Number(destination.coords.latitude))) {
      showToast("该城市缺少坐标，暂时无法联网刷新");
      return;
    }
    const preferredDate =
      state.route === "hotel" && state.plannerDraft
        ? state.plannerDraft.date
        : state.mapCheckIn;
    const checkIn = preferredDate || defaultTravelDate(1);
    const checkOut = addDaysToDate(checkIn, 1);
    state.sync = {
      status: "loading",
      message:
        "正在通过万豪官网更新 " +
        destination.name +
        " " +
        checkIn +
        " 的现金价与积分房价…",
      updatedAt: state.sync.updatedAt
    };
    render();
    try {
      window.AndroidHotelSync.requestCitySync(
        destination.id,
        Number(destination.coords.latitude),
        Number(destination.coords.longitude),
        destination.name,
        checkIn,
        checkOut
      );
    } catch (error) {
      state.sync = {
        status: "error",
        message: "无法发起联网更新：" + (error && error.message ? error.message : error),
        updatedAt: state.sync.updatedAt
      };
      render();
    }
  }

  function delay(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function requestFlyAiWithRetry(tool, args, attempts) {
    const maxAttempts = Math.max(1, attempts || 2);
    const run = (remaining) =>
      requestFlyAi(tool, args).catch((error) => {
        const message = String((error && error.message) || "");
        if (
          remaining > 1 &&
          /429|rate limit|超时|timeout|network|HTTP 5\d\d/i.test(message)
        ) {
          return delay(2200).then(() => run(remaining - 1));
        }
        throw error;
      });
    return run(maxAttempts);
  }

  function requestFlyAiCityHotelSearch(destination, checkIn, checkOut) {
    const primary = {
      destName: destination.cityFull || destination.name,
      checkInDate: checkIn,
      checkOutDate: checkOut
    };
    return requestFlyAiWithRetry("search_marriott_hotels", primary, 2).then(
      (payload) => {
        if (getFlyAiItems(payload).length) return payload;
        return requestFlyAiWithRetry(
          "search_marriott_hotels",
          Object.assign({}, primary, { destName: destination.name }),
          2
        );
      }
    );
  }

  function findFlyAiHotelItemForHotel(items, hotel) {
    const target = normalizeHotelKey(hotel.name);
    const exact = items.find(
      (item) => normalizeHotelKey(item && item.name) === target
    );
    if (exact) return exact;
    const partial = items
      .filter((item) => {
        const name = normalizeHotelKey(item && item.name);
        return (
          name.length >= 6 &&
          target.length >= 6 &&
          (name.includes(target) || target.includes(name))
        );
      })
      .sort(
        (a, b) =>
          Math.abs(normalizeHotelKey(a.name).length - target.length) -
          Math.abs(normalizeHotelKey(b.name).length - target.length)
      );
    return partial[0] || null;
  }

  function flyAiHotelNameVariants(name) {
    const value = cleanHotelText(name);
    return [
      value,
      value.replace(/万豪万枫/g, "万枫"),
      value.replace(/大酒店$/, "酒店"),
      value.replace(/高新西区|高新区|经开|新区/g, "")
    ].filter((item, index, list) => item && list.indexOf(item) === index);
  }

  function lookupFlyAiHotelPrice(hotelId, checkInInput, options) {
    const hotel = LOGIC.getHotel(hotelId);
    const destination = hotel ? LOGIC.getDestination(hotel.destinationId) : null;
    if (!hotel || !destination) {
      return Promise.reject(new Error("找不到这家酒店"));
    }
    if (!hasFlyAiBridge()) {
      return Promise.reject(new Error("飞猪查价仅在安装后的 Android App 中可用"));
    }
    const silent = Boolean(options && options.silent);
    const checkIn = checkInInput || state.mapCheckIn || defaultTravelDate(1);
    const checkOut = addDaysToDate(checkIn, 1);
    if (!silent) {
      state.flyAi = {
        status: "loading",
        message: "正在查询 " + hotel.name + " 在 " + checkIn + " 的公开起价…",
        updatedAt: state.flyAi.updatedAt
      };
      render();
    }
    const tryKeyword = (variants) => {
      const keyword = variants[0];
      return requestFlyAiWithRetry(
        "search_marriott_hotels",
        {
          destName: destination.cityFull || destination.name,
          keyWords: keyword,
          checkInDate: checkIn,
          checkOutDate: checkOut
        },
        2
      ).then((payload) => {
        const found = findFlyAiHotelItemForHotel(getFlyAiItems(payload), hotel);
        if (!found && variants.length > 1) {
          return tryKeyword(variants.slice(1));
        }
        return { payload, item: found };
      });
    };
    return tryKeyword(flyAiHotelNameVariants(hotel.name)).then((match) => {
      const payload = match.payload;
      const item = match.item || findFlyAiHotelItemForHotel(getFlyAiItems(payload), hotel);
      if (!item) {
        throw new Error("飞猪没有返回这家酒店的匹配记录");
      }
      const result = mergeFlyAiHotelResults(
        destination,
        {
          status: 0,
          message: payload.message || "success",
          systemMessage: payload.systemMessage || "",
          data: { itemList: [item] }
        },
        checkIn,
        checkOut
      );
      if (!hasPrice(hotel)) {
        throw new Error("该酒店在所选日期暂无可售价格");
      }
      if (!silent) {
        state.flyAi = {
          status: "success",
          message:
            hotel.name +
            " 已更新为 " +
            money(hotel.price) +
            " 飞猪公开起价（" +
            checkIn +
            " 入住 1 晚）。",
          updatedAt: new Date().toISOString()
        };
        const scrollY = window.scrollY;
        render();
        window.scrollTo(0, scrollY);
      }
      return { hotel, item, result };
    });
  }

  function updateFlyAiFillStatusText() {
    const target = document.getElementById("flyai-fill-status");
    if (!target) return;
    const fill = state.flyAiFill;
    target.textContent =
      fill.active && fill.total
        ? "正在补价 " +
          (fill.done + 1) +
          "/" +
          fill.total +
          " · " +
          fill.current
        : fill.total
          ? "补价完成 " +
            (fill.total - fill.failed) +
            "/" +
            fill.total +
            "，失败 " +
            fill.failed
          : "";
  }

  async function fillMissingFlyAiPrices(destinationId) {
    if (state.flyAiFill.active) return;
    const destination = LOGIC.getDestination(destinationId);
    if (!destination) return;
    const missing = LOGIC.hotelsFor(destination.id).filter(
      (hotel) => !hasPrice(hotel)
    );
    if (!missing.length) {
      showToast("本城酒店都已有价格");
      return;
    }
    state.flyAiFill = {
      active: true,
      total: missing.length,
      done: 0,
      failed: 0,
      current: missing[0].name
    };
    state.flyAi = {
      status: "loading",
      message: "正在逐家补齐 " + destination.name + " 的缺失房价…",
      updatedAt: state.flyAi.updatedAt
    };
    const scrollY = window.scrollY;
    render();
    window.scrollTo(0, scrollY);
    for (let index = 0; index < missing.length; index += 1) {
      state.flyAiFill.done = index;
      state.flyAiFill.current = missing[index].name;
      updateFlyAiFillStatusText();
      try {
        await lookupFlyAiHotelPrice(missing[index].id, state.mapCheckIn, {
          silent: true
        });
      } catch (error) {
        state.flyAiFill.failed += 1;
      }
      await delay(650);
    }
    state.flyAiFill.active = false;
    state.flyAiFill.done = missing.length;
    state.flyAiFill.current = "";
    state.flyAi = {
      status:
        state.flyAiFill.failed === missing.length ? "error" : "success",
      message:
        "逐家补价完成：" +
        (missing.length - state.flyAiFill.failed) +
        "/" +
        missing.length +
        " 家取得价格；失败 " +
        state.flyAiFill.failed +
        " 家。",
      updatedAt: new Date().toISOString()
    };
    const nextScrollY = window.scrollY;
    render();
    window.scrollTo(0, nextScrollY);
  }

  function refreshFlyAiCityPrices(destinationId, checkInInput) {
    const destination = LOGIC.getDestination(destinationId);
    if (!destination) {
      showToast("找不到这个城市");
      return Promise.reject(new Error("城市不存在"));
    }
    const preferredDate =
      state.route === "hotel" && state.plannerDraft
        ? state.plannerDraft.date
        : state.mapCheckIn;
    const checkIn = checkInInput || preferredDate || defaultTravelDate(1);
    const checkOut = addDaysToDate(checkIn, 1);
    state.mapCheckIn = checkIn;
    safeWrite("lvban.mapCheckIn.v1", checkIn);
    if (!hasFlyAiBridge()) {
      state.flyAi = {
        status: "error",
        message: "飞猪实时查价仅在安装后的 Android App 中可用。",
        updatedAt: null
      };
      render();
      return Promise.resolve(null);
    }
    state.flyAi = {
      status: "loading",
      message:
        "正在向飞猪查询 " +
        destination.name +
        " " +
        checkIn +
        " 入住 1 晚的万豪系酒店…",
      updatedAt: state.flyAi.updatedAt
    };
    render();
    return requestFlyAiCityHotelSearch(destination, checkIn, checkOut)
      .then((payload) => {
        const result = mergeFlyAiHotelResults(
          destination,
          payload,
          checkIn,
          checkOut
        );
        if (!result.priced) {
          throw new Error("飞猪未返回该日期可用的万豪酒店起价");
        }
        state.flyAi = {
          status: "success",
          message:
            "飞猪返回 " +
            result.total +
            " 条酒店记录，" +
            result.priced +
            " 家有起价；更新 " +
            result.updated +
            " 家，新增 " +
            result.added +
            " 家。",
          updatedAt: new Date().toISOString()
        };
        const scrollY = window.scrollY;
        render();
        window.scrollTo(0, scrollY);
        showToast("飞猪实时房价已合并到酒店目录");
        return result;
      })
      .catch((error) => {
        state.flyAi = {
          status: "error",
          message:
            "飞猪查价失败：" +
            (error && error.message ? error.message : "请检查网络后重试"),
          updatedAt: state.flyAi.updatedAt
        };
        const scrollY = window.scrollY;
        render();
        window.scrollTo(0, scrollY);
        showToast("飞猪查价失败，已保留现有目录与价格");
        throw error;
      });
  }

  window.onNativeHotelSyncResult = function (payloadJson) {
    try {
      const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
      const result = applyLiveHotelPayload(payload, true);
      state.sync = {
        status: "success",
        message:
          "已从万豪官方公开搜索更新 " +
          result.total +
          " 条城市附近记录；" +
          result.priced +
          " 家有公开报价，新增 " +
          result.added +
          " 家；" +
          result.pointsPriced +
          " 家取得积分房价。",
        updatedAt: new Date().toISOString()
      };
      const scrollY = window.scrollY;
      render();
      window.scrollTo(0, scrollY);
      showToast("官方酒店与房价更新完成");
    } catch (error) {
      window.onNativeHotelSyncError(
        "同步结果处理失败：" + (error && error.message ? error.message : error)
      );
    }
  };

  window.onNativeHotelSyncError = function (message) {
    state.sync = {
      status: "error",
      message: "更新失败：" + String(message || "未知错误"),
      updatedAt: state.sync.updatedAt
    };
    const scrollY = window.scrollY;
    render();
    window.scrollTo(0, scrollY);
    showToast("联网更新失败，已保留内置目录");
  };

  const savedPrefs = Object.assign({}, DEFAULT_PREFS, safeRead("lvban.prefs.v1", {}));
  let prefs = Object.assign({}, savedPrefs);
  let valuePrefs = Object.assign(
    {},
    LOGIC.VALUE_DEFAULTS,
    safeRead("lvban.valuePrefs.v1", {})
  );
  let favorites = new Set(
    safeRead("lvban.favorites.v1", []).filter((id) => Boolean(LOGIC.getHotel(id)))
  );
  let comparisons = new Set(
    safeRead("lvban.compare.v1", []).filter((id) => Boolean(LOGIC.getHotel(id)))
  );
  let checklist = safeRead("lvban.checklist.v1", {});
  let liveHotelCache = safeRead("lvban.liveHotelCache.v2", {});
  let flyAiHotelCache = safeRead("lvban.flyaiHotelCache.v3", {});
  let hotelInsightCache = Object.assign(
    {},
    BUNDLED_HOTEL_INSIGHTS.hotels || {},
    safeRead("lvban.hotelInsightCache.v1", {})
  );
  let flyAiResponseCache = safeRead("lvban.flyAiResponseCache.v1", {});
  let meituanGuideCache = safeRead("lvban.meituanGuideCache.v1", {});
  hydrateLiveHotelCache();
  hydrateFlyAiHotelCache();
  let onboardingDismissed = safeRead("lvban.onboarding.v1", false);

  const initialMapDestination =
    DATA.destinations.find((item) => item.name === savedPrefs.departure) ||
    DATA.destinations.find((item) => item.name === "上海") ||
    DATA.destinations[0];

  const state = {
    route: "home",
    navContext: "home",
    params: Object.assign({}, savedPrefs, {
      query: DEFAULT_QUERY,
      styles: savedPrefs.styles && savedPrefs.styles.length ? savedPrefs.styles : ["赏秋"]
    }),
    selectedDestinationId: null,
    selectedHotelId: null,
    mapCity: initialMapDestination ? initialMapDestination.id : null,
    mapBand: "all",
    mapManagement: "all",
    mapBrand: "all",
    mapQuery: "",
    mapAddress: "",
    mapAddressLabel: "",
    mapAddressLocation: null,
    mapAddressLoading: false,
    mapVisible: 16,
    mapSelectedHotelId: null,
    mapCheckIn: safeRead("lvban.mapCheckIn.v1", defaultTravelDate(1)),
    mapZoom: null,
    mapCenter: null,
    mapViewCity: null,
    mapLocation: null,
    mapLocationLoading: false,
    flyAi: {
      status: "idle",
      message: "",
      updatedAt: null
    },
    flyAiFill: {
      active: false,
      total: 0,
      done: 0,
      failed: 0,
      current: ""
    },
    directoryQuery: "",
    directoryRegion: "全国",
    directoryBrand: "all",
    directoryLimit: 24,
    rankMode: "quality",
    rankBand: "all",
    rankBrand: "all",
    rankRegion: "全国",
    rankScope: "all",
    rankSeason: "all",
    rankSort: "value",
    rankLimit: 20,
    rankExpandedId: null,
    rankSettingsOpen: false,
    tripTab: "planner",
    hotelInsightLoadingId: null,
    hotelInsightError: "",
    calc: safeRead("lvban.calc.v1", { cash: 1200, points: 30000 }),
    plannerDestinationId: initialMapDestination ? initialMapDestination.id : null,
    plannerDraft: safeRead("lvban.plannerDraft.v1", {
      origin: savedPrefs.departure || "上海",
      destinationId: initialMapDestination ? initialMapDestination.id : null,
      days: savedPrefs.days || 3,
      people: savedPrefs.people || 2,
      budget: savedPrefs.budget || 5000,
      interest: "赏秋",
      notes: "",
      pace: savedPrefs.lowWalking ? "relaxed" : "balanced",
      travelStyle: savedPrefs.travelStyle || "balanced"
    }),
    plannerLoading: false,
    plannerError: "",
    tripPlan: safeRead("lvban.tripPlan.v1", null),
    sync: {
      status: "idle",
      message: "",
      updatedAt: null
    }
  };

  const appMain = document.getElementById("app-main");
  const appHeader = document.getElementById("app-header");
  const bottomNav = document.getElementById("bottom-nav");
  const sheet = document.getElementById("sheet");
  const backdrop = document.getElementById("sheet-backdrop");
  const toastEl = document.getElementById("toast");
  let toastTimer = null;
  let leafletMap = null;
  let amapInstance = null;
  let amapMarkers = [];
  let amapLocationMarker = null;
  let amapAddressMarker = null;
  let amapInstanceCity = null;
  let amapViewGeneration = 0;
  let amapPromise = null;
  let flyAiRequestSequence = 0;
  const flyAiPending = new Map();
  let hotelInsightsBundlePromise = null;
  let hotelInsightsBundleReady = Boolean(window.APP_HOTEL_INSIGHTS);

  function mergeBundledHotelInsights(payload) {
    BUNDLED_HOTEL_INSIGHTS = payload && payload.hotels
      ? payload
      : { hotels: {} };
    Object.assign(hotelInsightCache, BUNDLED_HOTEL_INSIGHTS.hotels || {});
    hotelInsightsBundleReady = true;
    return BUNDLED_HOTEL_INSIGHTS;
  }

  function loadHotelInsightsBundle() {
    if (hotelInsightsBundleReady) {
      return Promise.resolve(BUNDLED_HOTEL_INSIGHTS);
    }
    if (hotelInsightsBundlePromise) return hotelInsightsBundlePromise;
    if (!document.createElement || !document.head) {
      return Promise.reject(new Error("酒店详情资料暂不可用"));
    }
    hotelInsightsBundlePromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = HOTEL_INSIGHTS_SCRIPT;
      script.async = true;
      script.onload = () => {
        resolve(mergeBundledHotelInsights(window.APP_HOTEL_INSIGHTS));
      };
      script.onerror = () => {
        hotelInsightsBundlePromise = null;
        reject(new Error("酒店详情资料加载失败"));
      };
      document.head.appendChild(script);
    });
    return hotelInsightsBundlePromise;
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character];
    });
  }

  function money(value) {
    return LOGIC.formatMoney(value);
  }

  function hasPrice(hotel) {
    return Number.isFinite(Number(hotel.price)) && Number(hotel.price) > 0;
  }

  function priceLabel(hotel) {
    return hasPrice(hotel) ? money(hotel.price) : "查价";
  }

  function pointsLabel(hotel) {
    const points = Number(hotel && hotel.pointsPrice);
    return Number.isFinite(points) && points > 0
      ? Math.round(points).toLocaleString("zh-CN") + " 分"
      : "积分待查";
  }

  function normalizePointsPromotion(value, fallbackSource) {
    if (!value) return null;
    const raw = Array.isArray(value)
      ? value.find((item) => item && /积分|bonus|points/i.test(JSON.stringify(item)))
      : value;
    if (!raw) return null;
    const object = typeof raw === "object" ? raw : { title: String(raw) };
    const title = cleanHotelText(
      object.title ||
        object.name ||
        object.label ||
        object.description ||
        object.promotionName ||
        ""
    );
    const numericCandidates = [
      object.bonusPoints,
      object.extraPoints,
      object.rewardPoints,
      object.points,
      object.bonus
    ];
    let bonusPoints = numericCandidates
      .map((item) => Number(String(item == null ? "" : item).replace(/,/g, "")))
      .find((item) => Number.isFinite(item) && item > 0);
    if (!bonusPoints && title) {
      const match = title.match(
        /(?:额外|加赠|赠送|送|bonus)[^0-9]{0,8}(\d{1,6})\s*分/i
      );
      if (match) bonusPoints = Number(match[1]);
    }
    if (!bonusPoints || !Number.isFinite(bonusPoints)) return null;
    return {
      bonusPoints: Math.round(bonusPoints),
      title: title || "额外赠送万豪积分",
      validFrom: object.validFrom || object.startDate || object.valid_start || null,
      validTo: object.validTo || object.endDate || object.valid_end || null,
      source:
        object.source ||
        object.sourceLabel ||
        fallbackSource ||
        "公开活动数据",
      fetchedAt: object.fetchedAt || new Date().toISOString()
    };
  }

  function bundledPointsPromotion(hotel) {
    const hotels = BUNDLED_POINTS_PROMOTIONS.hotels || {};
    const direct = hotels[hotel.id];
    if (direct) {
      return normalizePointsPromotion(
        direct,
        BUNDLED_POINTS_PROMOTIONS.source || "本地积分闪促快照"
      );
    }
    const target = normalizeHotelKey(hotel.name);
    const match = Object.values(hotels).find(
      (item) => item && normalizeHotelKey(item.hotelName || item.name) === target
    );
    return match
      ? normalizePointsPromotion(
          match,
          BUNDLED_POINTS_PROMOTIONS.source || "本地积分闪促快照"
        )
      : null;
  }

  function pointsPromotionForHotel(hotel) {
    return (
      normalizePointsPromotion(hotel && hotel.pointsPromotion, "实时酒店数据") ||
      bundledPointsPromotion(hotel)
    );
  }

  function pointsPromotionLabel(hotel) {
    const promotion = pointsPromotionForHotel(hotel);
    if (!promotion) return "";
    const validUntil = promotion.validTo
      ? " · 截至 " + formatDate(promotion.validTo)
      : "";
    return (
      "积分闪促：额外赠 " +
      Math.round(promotion.bonusPoints).toLocaleString("zh-CN") +
      " 分" +
      validUntil
    );
  }

  function pointsPromotionFromFlyAiItem(item) {
    const direct = normalizePointsPromotion(
      item.pointsPromotion ||
        item.bonusPointsPromotion ||
        item.promotionInfo ||
        item.promotions ||
        item.promotion,
      "飞猪酒店实时返回"
    );
    if (direct) return direct;
    const bonus = normalizePointsPromotion(
      {
        bonusPoints:
          item.bonusPoints || item.extraPoints || item.pointsBonus || null,
        title:
          item.bonusPointsTitle ||
          item.promotionTitle ||
          item.activityName ||
          "",
        validFrom: item.promotionStart || item.validFrom,
        validTo: item.promotionEnd || item.validTo,
        source: "飞猪酒店实时返回"
      },
      "飞猪酒店实时返回"
    );
    return bonus;
  }

  function pointsValuation(hotel) {
    const cash = Number(hotel && hotel.price);
    const points = Number(hotel && hotel.pointsPrice);
    const sampleCash = Number(state.calc && state.calc.cash);
    const samplePoints = Number(state.calc && state.calc.points);
    if (
      !Number.isFinite(cash) ||
      cash <= 0 ||
      !Number.isFinite(points) ||
      points <= 0 ||
      !Number.isFinite(sampleCash) ||
      sampleCash <= 0 ||
      !Number.isFinite(samplePoints) ||
      samplePoints <= 0
    ) {
      return null;
    }
    const perTenThousand = (sampleCash / samplePoints) * 10000;
    const estimated = Math.round((points / 10000) * perTenThousand);
    return {
      estimated,
      difference: Math.round(cash - estimated),
      perTenThousand
    };
  }

  function pointsValueLabel(hotel) {
    const valuation = pointsValuation(hotel);
    if (!valuation) return "";
    return (
      pointsLabel(hotel) +
      "约值 " +
      money(valuation.estimated) +
      " · " +
      (valuation.difference >= 0 ? "较现金低 " : "较现金高 ") +
      money(Math.abs(valuation.difference)) +
      "（按当前积分估值）"
    );
  }

  function travelStyleLabel(value) {
    return value === "distinctive" ? "别具一格" : "性价比和质量平衡";
  }

  function isFliggyUrl(value) {
    try {
      const url = new URL(String(value || ""));
      const host = url.hostname.toLowerCase();
      return (
        url.protocol === "https:" &&
        (host === "feizhu.com" ||
          host.endsWith(".feizhu.com") ||
          host === "fliggy.com" ||
          host.endsWith(".fliggy.com"))
      );
    } catch (error) {
      return false;
    }
  }

  function bookingButton(url, label, className, style) {
    if (!url) return "";
    const classes = className || "btn btn-gold btn-block";
    const styleAttr = style ? ' style="' + esc(style) + '"' : "";
    if (isFliggyUrl(url)) {
      return (
        '<button type="button" class="' +
        esc(classes) +
        '"' +
        styleAttr +
        ' data-action="open-fliggy-booking" data-booking-url="' +
        esc(url) +
        '">' +
        icon("external") +
        esc(label) +
        "</button>"
      );
    }
    return (
      '<a class="' +
      esc(classes) +
      '"' +
      styleAttr +
      ' href="' +
      esc(url) +
      '" target="_self">' +
      icon("external") +
      esc(label) +
      "</a>"
    );
  }

  function openFliggyBooking(url) {
    if (!isFliggyUrl(url)) {
      showToast("当前链接不是可识别的飞猪链接");
      return;
    }
    if (
      window.AndroidFliggy &&
      typeof window.AndroidFliggy.openHotel === "function"
    ) {
      window.AndroidFliggy.openHotel(url);
      return;
    }
    window.location.assign(url);
  }

  function qualityLabel(hotel) {
    const value = Number(hotel && hotel.quality);
    return Number.isFinite(value) && value > 0 ? value.toFixed(1) : "待补";
  }

  function priceSourceLabel(hotel) {
    const meta = (hotel && hotel.priceMeta) || {};
    if (meta.sourceLabel) return meta.sourceLabel;
    if (String(meta.source || "").includes("Fliggy")) return "飞猪实时起价";
    if (String(meta.source || "").includes("Marriott")) return "万豪官方报价";
    return "公开报价";
  }

  function formatDate(value) {
    if (!value) return "待核验";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return (
      date.getFullYear() +
      "-" +
      ("0" + (date.getMonth() + 1)).slice(-2) +
      "-" +
      ("0" + date.getDate()).slice(-2)
    );
  }

  function defaultTravelDate(offset) {
    const date = new Date();
    date.setDate(date.getDate() + (offset || 0));
    return (
      date.getFullYear() +
      "-" +
      ("0" + (date.getMonth() + 1)).slice(-2) +
      "-" +
      ("0" + date.getDate()).slice(-2)
    );
  }

  function addDaysToDate(value, days) {
    const date = new Date(String(value || defaultTravelDate(1)) + "T12:00:00");
    if (Number.isNaN(date.getTime())) return "";
    date.setDate(date.getDate() + (days || 0));
    return defaultDateFromObject(date);
  }

  function defaultDateFromObject(date) {
    return (
      date.getFullYear() +
      "-" +
      ("0" + (date.getMonth() + 1)).slice(-2) +
      "-" +
      ("0" + date.getDate()).slice(-2)
    );
  }

  function plannerStraightLineKm(a, b) {
    if (
      !Array.isArray(a) ||
      !Array.isArray(b) ||
      a.length < 2 ||
      b.length < 2 ||
      !a.every((value) => Number.isFinite(Number(value))) ||
      !b.every((value) => Number.isFinite(Number(value)))
    ) {
      return null;
    }
    const radius = 6371;
    const toRad = (value) => (value * Math.PI) / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(a[1])) *
        Math.cos(toRad(b[1])) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return Math.round(2 * radius * Math.asin(Math.sqrt(h)) * 10) / 10;
  }

  function formatDuration(seconds) {
    const minutes = Math.max(1, Math.round(Number(seconds) / 60));
    if (minutes < 60) return minutes + " 分钟";
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours + " 小时" + (rest ? " " + rest + " 分钟" : "");
  }

  function modeTag(mode) {
    if (!mode || mode === "unverified") return "";
    return (
      '<span class="mode-tag ' +
      esc(mode) +
      '">' +
      esc(DATA.managementModes[mode] || "") +
      "</span>"
    );
  }

  function hotelInitial(hotel) {
    return esc((hotel.brand || hotel.name || "M").slice(0, 1));
  }

  function icon(name) {
    return ICONS[name] || "";
  }

  function persistPrefs() {
    prefs = {
      departure: state.params.departure,
      month: state.params.month,
      days: state.params.days,
      people: state.params.people,
      rooms: state.params.rooms,
      budget: state.params.budget,
      styles: state.params.styles || [],
      lowWalking: Boolean(state.params.lowWalking),
      travelStyle: state.params.travelStyle || "balanced",
      destinationName: state.params.destinationName || "",
      date: state.params.date || null
    };
    safeWrite("lvban.prefs.v1", prefs);
  }

  function persistFavorites() {
    safeWrite("lvban.favorites.v1", Array.from(favorites));
  }

  function persistComparisons() {
    safeWrite("lvban.compare.v1", Array.from(comparisons));
  }

  function persistChecklist() {
    safeWrite("lvban.checklist.v1", checklist);
  }

  function navKey(route) {
    if (route === "map") return "map";
    if (route === "directory") return "directory";
    if (route === "rankings") return "rankings";
    if (route === "trip") return "trip";
    return "home";
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastEl.classList.remove("is-visible");
    }, 2300);
  }

  function renderHeader() {
    appHeader.innerHTML =
      '<button class="brand-button" data-nav="home" aria-label="回到首页">' +
      '<span class="brand-mark">' +
      icon("brand") +
      "</span>" +
      '<span class="brand-copy">' +
      '<span class="brand-title">旅伴</span>' +
      '<span class="brand-subtitle">Bonvoy Decision Studio</span>' +
      "</span>" +
      "</button>" +
      '<div class="header-actions">' +
      '<span class="data-mode-pill">' +
      (KEYLESS_BUILD ? "离线无密钥版" : "全国酒店目录") +
      "</span>" +
      '<button class="icon-button" data-action="open-settings" aria-label="打开设置" title="出行偏好">' +
      icon("settings") +
      "</button>" +
      "</div>";
  }

  function renderBottomNav() {
    const items = [
      { nav: "home", label: "探索", icon: "compass" },
      { nav: "map", label: "地图", icon: "map" },
      { nav: "directory", label: "酒店", icon: "building" },
      { nav: "rankings", label: "榜单", icon: "chart" },
      { nav: "trip", label: "行程", icon: "bookmark" }
    ];
    const active = state.navContext || navKey(state.route);
    bottomNav.innerHTML = items
      .map((item) => {
        return (
          '<button class="nav-button ' +
          (active === item.nav ? "is-active" : "") +
          '" data-nav="' +
          item.nav +
          '" aria-current="' +
          (active === item.nav ? "page" : "false") +
          '" aria-label="' +
          item.label +
          '">' +
          icon(item.icon) +
          "<span>" +
          item.label +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function historySnapshot() {
    return {
      route: state.route,
      navContext: state.navContext,
      selectedDestinationId: state.selectedDestinationId,
      selectedHotelId: state.selectedHotelId,
      directoryQuery: state.directoryQuery,
      directoryRegion: state.directoryRegion,
      directoryBrand: state.directoryBrand,
      directoryLimit: state.directoryLimit,
      mapCity: state.mapCity,
      mapBand: state.mapBand,
      mapManagement: state.mapManagement,
      mapBrand: state.mapBrand,
      mapQuery: state.mapQuery,
      mapAddress: state.mapAddress,
      mapAddressLabel: state.mapAddressLabel,
      mapAddressLocation: state.mapAddressLocation,
      mapVisible: state.mapVisible,
      mapSelectedHotelId: state.mapSelectedHotelId,
      mapCheckIn: state.mapCheckIn,
      mapZoom: state.mapZoom,
      mapCenter: state.mapCenter,
      mapViewCity: state.mapViewCity,
      rankScope: state.rankScope,
      rankBand: state.rankBand,
      rankBrand: state.rankBrand,
      rankSeason: state.rankSeason,
      rankSort: state.rankSort
    };
  }

  function replaceHistorySnapshot() {
    if (window.history && history.replaceState) {
      history.replaceState(historySnapshot(), "");
    }
  }

  function navigate(route, patch, push) {
    const shouldPush = push !== false;
    if (
      route === "hotel" &&
      patch &&
      patch.selectedHotelId &&
      patch.selectedHotelId !== state.selectedHotelId
    ) {
      state.hotelInsightError = "";
    }
    Object.assign(state, patch || {});
    state.route = route;
    if (!patch || !Object.prototype.hasOwnProperty.call(patch, "navContext")) {
      state.navContext = navKey(route);
    }
    if (shouldPush && window.history && history.pushState) {
      history.pushState(historySnapshot(), "");
    }
    render();
    window.scrollTo({ top: 0, behavior: shouldPush ? "smooth" : "auto" });
  }

  function restoreHistory(payload) {
    if (!payload) {
      state.route = "home";
      state.navContext = "home";
    } else {
      state.route = payload.route || "home";
      state.navContext = payload.navContext || navKey(state.route);
      state.selectedDestinationId = payload.selectedDestinationId || null;
      state.selectedHotelId = payload.selectedHotelId || null;
      state.directoryQuery = payload.directoryQuery || "";
      state.directoryRegion = payload.directoryRegion || "全国";
      state.directoryBrand = payload.directoryBrand || "all";
      state.directoryLimit = Number(payload.directoryLimit) || 24;
      state.rankScope = payload.rankScope || "all";
      state.rankBand = payload.rankBand || "all";
      state.rankBrand = payload.rankBrand || "all";
      state.rankSeason = payload.rankSeason || "all";
      state.rankSort = payload.rankSort || "value";
      state.rankLimit = 20;
      state.rankExpandedId = null;
      state.mapCity = payload.mapCity || state.mapCity;
      state.mapBand = payload.mapBand || "all";
      state.mapManagement = payload.mapManagement || "all";
      state.mapBrand = payload.mapBrand || "all";
      state.mapQuery = payload.mapQuery || "";
      state.mapAddress = payload.mapAddress || "";
      state.mapAddressLabel = payload.mapAddressLabel || "";
      state.mapAddressLocation =
        payload.mapAddressLocation &&
        Number.isFinite(Number(payload.mapAddressLocation.longitude)) &&
        Number.isFinite(Number(payload.mapAddressLocation.latitude))
          ? payload.mapAddressLocation
          : null;
      state.mapVisible = Number(payload.mapVisible) || 16;
      state.mapSelectedHotelId = payload.mapSelectedHotelId || null;
      state.mapCheckIn = payload.mapCheckIn || state.mapCheckIn;
      state.mapZoom =
        Number.isFinite(Number(payload.mapZoom)) ? Number(payload.mapZoom) : null;
      state.mapCenter =
        payload.mapCenter &&
        Number.isFinite(Number(payload.mapCenter.longitude)) &&
        Number.isFinite(Number(payload.mapCenter.latitude))
          ? payload.mapCenter
          : null;
      state.mapViewCity = payload.mapViewCity || null;
    }
    render();
  }

  window.appBack = function () {
    if (!sheet.hidden) {
      closeSheet();
      return true;
    }
    if (state.route !== "home") {
      history.back();
      return true;
    }
    return false;
  };

  function monthOptions(selected) {
    return MONTHS.map((month) => {
      return (
        '<option value="' +
        month +
        '"' +
        (Number(selected) === month ? " selected" : "") +
        ">" +
        month +
        " 月</option>"
      );
    }).join("");
  }

  function countOptions(min, max, selected, suffix) {
    const options = [];
    for (let value = min; value <= max; value += 1) {
      options.push(
        '<option value="' +
          value +
          '"' +
          (Number(selected) === value ? " selected" : "") +
          ">" +
          value +
          suffix +
          "</option>"
      );
    }
    return options.join("");
  }

  function hasPropertyPhoto(hotel) {
    // Marriott also returns shared brand artwork for properties without photos.
    return Boolean(hotel && hotel.imageUrl &&
      !/\/(?:regional-brand-exclusive|global-brand-exclusive|global-property-shared)\//i.test(hotel.imageUrl));
  }

  function hotelImageMarkup(hotel, className, loading) {
    if (!hasPropertyPhoto(hotel)) {
      return (
        '<div class="' +
        className +
        ' image-fallback image-unavailable" role="img" aria-label="暂无酒店照片">' +
        icon("building") +
        "</div>"
      );
    }
    return (
      '<div class="' +
      className +
      '"><span class="photo-fallback" aria-hidden="true">' +
      icon("building") +
      '</span><img data-hotel-photo src="' +
      esc(hotel.imageUrl) +
      '" alt="' +
      esc(hotel.name || "酒店照片") +
        '" decoding="async" fetchpriority="low"' +
      (loading ? ' loading="' + loading + '"' : "") +
      " /></div>"
    );
  }

  function renderHome() {
    const pricedCount = DATA.hotels.filter(hasPrice).length;
    const featuredHotel =
      DATA.hotels.find(
        (hotel) => hasPropertyPhoto(hotel) && hotel.brandTier === "奢华"
      ) || DATA.hotels.find(hasPropertyPhoto) || DATA.hotels[0];
    const featuredHotels = DATA.hotels
      .filter(
        (hotel) =>
          hasPropertyPhoto(hotel) &&
          hotel.brandTier === "奢华" &&
          (!featuredHotel || hotel.id !== featuredHotel.id)
      )
      .slice()
      .sort((a, b) => Number(b.quality || 0) - Number(a.quality || 0))
      .slice(0, 3);
    return (
      '<div class="screen home-screen">' +
      '<section class="home-search-panel"><div class="section-head home-search-head"><div><span class="eyebrow eyebrow-dark">BONVOY COLLECTION</span><h2>酒店探索</h2></div><span class="home-catalog-count">' +
      DATA.hotels.length + ' 家酒店 · ' + DATA.destinations.length + ' 个城市</span></div>' +
      '<form id="home-directory-search" class="home-search-form"><label class="home-query-field">' +
      icon("search") + '<input id="home-directory-query" type="search" aria-label="搜索城市、酒店或品牌" placeholder="城市、酒店或品牌" /></label>' +
      '<button class="btn btn-primary search-submit" type="submit">搜索酒店 ' + icon("arrowRight") + '</button></form>' +
      '<div class="home-city-links"><span>目的地</span>' +
      ["上海", "杭州", "三亚", "成都", "香港"].map((city) =>
        '<button data-action="browse-city" data-query="' + city + '">' + city + '</button>'
      ).join("") + '</div></section>' +
      '<section class="home-hero">' +
      (hasPropertyPhoto(featuredHotel)
        ? '<img class="home-hero-image" data-hotel-photo src="' +
          esc(featuredHotel.imageUrl) +
          '" alt="' +
          esc(featuredHotel.name || "酒店照片") +
          '" decoding="async" fetchpriority="high"' +
          ' />'
        : "") +
      '<div class="home-hero-content"><span class="eyebrow">' +
      esc(featuredHotel ? featuredHotel.brand : "万豪旅享家") +
      ' · ' +
      esc(featuredHotel ? featuredHotel.city || featuredHotel.area : "全国") +
      '</span><h1>' +
      esc(featuredHotel ? featuredHotel.name : "全国酒店目录") +
      '</h1>' +
      (featuredHotel
        ? '<button class="home-hero-link" data-action="view-hotel" data-id="' +
          esc(featuredHotel.id) + '">探索酒店 ' + icon("arrowRight") + '</button>'
        : '<p>酒店目录暂不可用，请稍后重新加载。</p>') +
      '</div>' +
      (hasPropertyPhoto(featuredHotel)
        ? '<span class="home-photo-credit">万豪公开目录图片</span>' : '') +
      '</section>' +
      '<div class="home-discovery-grid"><button class="home-route-link" data-action="go-map"><span>' +
      icon("map") +
      '</span><strong>地图选酒店</strong>' +
      icon("arrowRight") +
      '</button><button class="home-route-link" data-action="go-rankings"><span>' +
      icon("chart") +
      '</span><strong>地区榜单</strong>' +
      icon("arrowRight") +
      '</button><button class="home-route-link" data-action="go-trip"><span>' +
      icon("compass") +
      '</span><strong>规划行程</strong>' +
      icon("arrowRight") +
      "</button></div>" +
      '<section class="section home-featured-section"><div class="section-head"><div><span class="eyebrow eyebrow-dark">THE LUXURY EDIT</span><h2>奢华品牌精选</h2></div><button class="section-link" data-action="go-directory">全部酒店 ' +
      icon("arrowRight") + '</button></div><div class="home-featured-list">' +
      featuredHotels
        .map(
          (hotel) =>
            '<button class="home-featured-hotel" data-action="view-hotel" data-id="' +
            esc(hotel.id) +
            '">' +
            hotelImageMarkup(hotel, "home-featured-image", "lazy") +
            '<span class="home-featured-copy"><small>' +
            esc(hotel.brand) +
            " · " +
            esc(hotel.city || hotel.area) +
            '</small><strong>' +
            esc(hotel.name) +
            '</strong><span>' +
            (hasPrice(hotel) ? esc(priceLabel(hotel)) + " / 晚 · 参考价" : "公开价格待核验") +
            '</span></span><span class="home-featured-arrow">' +
            icon("arrowRight") +
            "</span></button>"
        )
        .join("") +
      "</div></section>" +
      '<div class="method-note">' +
      icon("info") +
      "<span>万豪公开目录 · " +
      esc(formatDate(DATA.updatedAt)) +
      " 更新 · " + pricedCount + " 家有报价快照。参考价非实时库存，实际价格与会员权益以预订渠道为准。</span>" +
      "</div>" +
      "</div>"
    );
  }

  function directoryBrandOptions() {
    const counts = {};
    DATA.hotels.forEach((hotel) => {
      if (hotel.brand) counts[hotel.brand] = (counts[hotel.brand] || 0) + 1;
    });
    return Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b, "zh-CN"))
      .map(
        (brand) =>
          '<option value="' +
          esc(brand) +
          '"' +
          (state.directoryBrand === brand ? " selected" : "") +
          ">" +
          esc(brand) +
          " · " +
          counts[brand] +
          " 家</option>"
      )
      .join("");
  }

  function directoryHotelSummary(hotel) {
    const distanceText = Number.isFinite(Number(hotel.distanceFromCenterKm))
      ? "距城市中心约 " + hotel.distanceFromCenterKm + " 公里。"
      : "";
    const ratingText = hotel.rating
      ? "万豪官方评分为 " +
        hotel.rating.toFixed(1) +
        "/5，公开评价约 " +
        (hotel.reviewCount || 0) +
        " 条。"
      : "万豪官方评分样本暂缺。";
    const priceText = hasPrice(hotel)
      ? "当前公开含税参考价约 " +
        money(hotel.price) +
        "/晚（" +
        (hotel.priceMeta && hotel.priceMeta.checkIn
          ? formatDate(hotel.priceMeta.checkIn)
          : "查询日期待确认") +
        "）。"
      : "当前未取得公开报价，价格需以官方渠道为准。";
    let text =
      hotel.name +
      "位于" +
      (hotel.province || "") +
      (hotel.city || hotel.area || "") +
      "，属于万豪旗下" +
      hotel.brand +
      "品牌，定位为" +
      hotel.brandTier +
      "。" +
      (hotel.intro || "") +
      ratingText +
      distanceText +
      priceText;
    const extraSentences = [
      "酒店的具体床型、早餐、酒廊、取消政策和会员权益会随房型与入住日期变化，预订前应以官方页面和酒店确认为准。",
      "如果重视通勤，请优先核对酒店到主要行程区域的高德路线；如果重视度假，请核对泳池、健身房和亲子设施的开放时间。",
      "目录中的价格是公开快照，不代表实时库存；会员登录价、积分房和连住优惠需要再次查询。"
    ];
    let extraIndex = 0;
    while (Array.from(text).length < 150 && extraIndex < extraSentences.length) {
      text += extraSentences[extraIndex++];
    }
    return LOGIC.truncateByChars(text, 300);
  }

  function renderDirectory() {
    const query = state.directoryQuery.trim().toLowerCase();
    let hotels = DATA.hotels.filter((hotel) => {
      const regionOk =
        state.directoryRegion === "全国" || hotel.region === state.directoryRegion;
      const brandOk =
        state.directoryBrand === "all" || hotel.brand === state.directoryBrand;
      const textOk =
        !query ||
        String(hotel.name || "").toLowerCase().includes(query) ||
        String(hotel.nameEn || "").toLowerCase().includes(query) ||
        String(hotel.city || "").toLowerCase().includes(query) ||
        String(hotel.province || "").toLowerCase().includes(query) ||
        String(hotel.brand || "").toLowerCase().includes(query);
      return regionOk && brandOk && textOk;
    });
    hotels.sort(
      (a, b) =>
        String(a.province || "").localeCompare(String(b.province || ""), "zh-CN") ||
        String(a.city || "").localeCompare(String(b.city || ""), "zh-CN") ||
        b.quality - a.quality
    );
    const visible = hotels.slice(0, state.directoryLimit);
    return (
      '<div class="screen">' +
      '<div class="section-head"><div><h1 class="page-title">全国酒店目录</h1><p class="page-subtitle">' +
      DATA.hotels.length +
      " 家酒店 · " +
      DATA.destinations.length +
      " 个城市 · 本地可查</p></div>" +
      '<span class="source-badge">官方目录快照</span></div>' +
      '<form class="card directory-filter" id="directory-search-form">' +
      '<div class="map-search-form"><input id="directory-query-input" value="' +
      esc(state.directoryQuery) +
      '" placeholder="搜索酒店名、城市或品牌" aria-label="搜索酒店目录" /><button class="btn btn-primary" type="submit">搜索</button></div>' +
      '<div class="filter-select-grid"><label class="field"><span>地区</span><select id="directory-region">' +
      DATA.regions
        .map(
          (region) =>
            '<option value="' +
            esc(region) +
            '"' +
            (state.directoryRegion === region ? " selected" : "") +
            ">" +
            esc(region) +
            "</option>"
        )
        .join("") +
      '</select></label><label class="field"><span>万豪子品牌</span><select id="directory-brand">' +
      '<option value="all"' +
      (state.directoryBrand === "all" ? " selected" : "") +
      ">全部品牌</option>" +
      directoryBrandOptions() +
      "</select></label></div></form>" +
      '<div class="directory-result-head"><strong>' +
      hotels.length +
      " 家符合条件的酒店</strong><span>资料取自万豪公开目录与评分</span></div>" +
      (visible.length
        ? '<div class="directory-list">' +
          visible
            .map((hotel) => {
              return (
                '<article class="directory-entry card">' +
                hotelImageMarkup(hotel, "directory-entry-image", "lazy") +
                '<div class="directory-entry-body"><div class="directory-entry-head"><div><span class="eyebrow eyebrow-dark">' +
                esc(hotel.province) +
                " · " +
                esc(hotel.city || hotel.area) +
                "</span><h2>" +
                esc(hotel.name) +
                '</h2><p>' +
                esc(hotel.nameEn) +
                "</p></div><div class=\"directory-price\"><strong>" +
                esc(priceLabel(hotel)) +
                "</strong><span>" +
                (hasPrice(hotel) ? "含税参考/晚" : "官方查价") +
                (Number(hotel.pointsPrice) > 0
                  ? '<br /><span class="directory-points-price">' +
                    esc(pointsLabel(hotel)) +
                    " 积分房</span>"
                  : "") +
                "</span></div></div>" +
                '<div class="inline-chips"><span class="inline-chip">' +
                esc(hotel.brand) +
                '</span><span class="inline-chip">' +
                esc(hotel.brandTier) +
                '</span><span class="inline-chip">评分 ' +
                (hotel.rating ? hotel.rating.toFixed(1) : "待补") +
                "</span></div>" +
                (hasPrice(hotel) && hotel.priceMeta && hotel.priceMeta.checkIn
                  ? '<p class="directory-price-date">参考入住日 ' +
                    esc(formatDate(hotel.priceMeta.checkIn)) + '</p>'
                  : '') +
                '<p class="directory-summary">' +
                esc(directoryHotelSummary(hotel)) +
                "</p>" +
                '<div class="directory-entry-actions"><button class="btn btn-secondary" data-action="view-hotel" data-id="' +
                esc(hotel.id) +
                '">查看详情</button><button class="btn btn-ghost" data-action="toggle-favorite" data-id="' +
                esc(hotel.id) +
                '">' +
                (favorites.has(hotel.id) ? "已收藏" : "收藏") +
                "</button></div></div></article>"
              );
            })
            .join("") +
          "</div>"
        : emptyState(
            "没有匹配的酒店",
            "试试减少筛选条件，或直接搜索城市和品牌。",
            "清除筛选",
            "reset-directory-filters"
          )) +
      (hotels.length > visible.length
        ? '<button class="btn btn-secondary btn-block" style="margin-top:12px" data-action="load-more-directory">继续显示更多酒店</button>'
        : "") +
      '<div class="method-note">' +
      icon("info") +
      "<span>当前目录速评是对万豪官方介绍、评分、坐标和价格资料的中文整理，不是伪装成用户的原话。酒店详情中的公开评论摘要来自已打包的飞猪和携程数据。</span>" +
      "</div></div>"
    );
  }

  function readSearchForm() {
    const query = document.getElementById("query-input").value.trim();
    const base = {
      query,
      departure: document.getElementById("departure-input").value.trim() || "上海",
      destinationName: document.getElementById("destination-input").value.trim(),
      date: document.getElementById("date-input").value || defaultTravelDate(1),
      month:
        Number(
          (document.getElementById("month-input") || {}).value ||
            (document.getElementById("date-input") || {}).value?.slice(5, 7)
        ) ||
        11,
      days: Number(document.getElementById("days-input").value) || 3,
      people: Number(document.getElementById("people-input").value) || 2,
      rooms: 1,
      budget: Number(document.getElementById("budget-input").value) || 5000,
      styles: [],
      lowWalking: state.params.lowWalking
    };
    const parsed = LOGIC.parseQuery(query, base);
    parsed.query = query || DEFAULT_QUERY;
    parsed.departure = base.departure;
    parsed.destinationName = base.destinationName;
    parsed.date = base.date;
    parsed.month = base.month;
    parsed.days = base.days;
    parsed.people = base.people;
    parsed.rooms = 1;
    parsed.budget = base.budget;
    parsed.lowWalking = Boolean(state.params.lowWalking);
    parsed.styles = parsed.styles.length ? parsed.styles : ["赏秋"];
    state.params = parsed;
    persistPrefs();
    navigate("results", {
      selectedDestinationId: null,
      selectedHotelId: null,
      navContext: "home"
    });
  }

  function interpretationChips(params) {
    const chips = [
      params.departure + "出发",
      params.month + " 月",
      params.days + " 天 " + Math.max(1, params.days - 1) + " 晚",
      params.people + " 人",
      "预算 " + money(params.budget),
      params.people > 1 ? "1 间房" : "1 间房"
    ];
    (params.styles || []).forEach((style) => chips.push(style));
    if (params.lowWalking) chips.push("少走路");
    return chips
      .map((chip) => '<span class="interpret-chip">' + esc(chip) + "</span>")
      .join("");
  }

  function renderResults() {
    const recommendations = LOGIC.recommendDestinations(state.params);
    const rankLabels = ["首选", "更松弛", "另一种风景"];
    return (
      '<div class="screen">' +
      '<div class="back-row"><button class="back-button" data-action="go-home">' +
      icon("arrowLeft") +
      '调整条件</button><span class="micro muted">全国目录 · 意图匹配</span></div>' +
      '<div class="interpret-card">' +
      '<div class="interpret-head"><strong>我已理解你的旅行</strong>' +
      '<button data-action="go-home">修改</button></div>' +
      '<div class="interpret-chips">' +
      interpretationChips(state.params) +
      "</div>" +
      "</div>" +
      '<div class="result-list">' +
      recommendations
        .map((result, index) => {
          const destination = result.destination;
          const hotel = result.hotel;
          const cost = result.cost;
          const within = cost.difference >= 0;
          return (
            '<article class="result-card ' +
            (index === 0 ? "top" : "") +
            '">' +
            '<div class="result-topline">' +
            '<span class="result-rank" data-index="0' +
            (index + 1) +
            '">' +
            rankLabels[index] +
            "</span>" +
            '<span class="match-score"><strong>' +
            result.match +
            "</strong>/100 匹配</span>" +
            "</div>" +
            '<div class="result-heading"><h2>' +
            esc(destination.name) +
            "</h2><span>" +
            esc(destination.province) +
            "</span></div>" +
            '<p class="result-tagline">' +
            esc(destination.tagline) +
            "</p>" +
            '<div class="season-bar"><strong>' +
            esc(result.season.label) +
            "</strong><span>" +
            esc(destination.bestWindow) +
            " · " +
            esc(destination.seasonLabel) +
            "</span><em>秋色置信度 " +
            esc(destination.seasonConfidence) +
            "</em></div>" +
            (hotel
              ? '<button class="result-hotel" data-action="view-hotel" data-id="' +
                esc(hotel.id) +
                '">' +
                '<span class="result-hotel-mark">' +
                hotelInitial(hotel) +
                "</span>" +
                '<span class="result-hotel-copy"><strong>' +
                esc(hotel.name) +
                "</strong><span>" +
                esc(hotel.area) +
                "</span></span>" +
                '<span class="result-hotel-price"><strong>' +
                esc(priceLabel(hotel)) +
                "</strong><span>" +
                (hasPrice(hotel) ? priceSourceLabel(hotel) + " / 晚" : "官方渠道查价") +
                "</span></span>" +
                "</button>"
              : "") +
            '<ul class="reason-list">' +
            result.reasons
              .map((reason) => "<li>" + esc(reason) + "</li>")
              .join("") +
            "</ul>" +
            '<div class="budget-row">' +
            '<div class="budget-main"><strong>' +
            money(cost.total) +
            "</strong><span>估算总费用 · 住宿" +
            (cost.priceKnown ? "含官方价" : "按品牌档次估算") +
            " · " +
            esc(cost.route.mode) +
            " " +
            esc(cost.route.time) +
            "</span></div>" +
            '<span class="budget-status ' +
            (within ? "" : "over") +
            '">' +
            (within
              ? "预算内 · 余 " + money(cost.difference)
              : "超预算 " + money(Math.abs(cost.difference))) +
            "</span>" +
            "</div>" +
            '<div class="card-actions">' +
            '<button class="btn btn-secondary" data-action="view-destination" data-id="' +
            esc(destination.id) +
            '">看行程</button>' +
            '<button class="btn btn-primary" data-action="open-destination-map" data-id="' +
            esc(destination.id) +
            '">地图选酒店</button>' +
            "</div>" +
            "</article>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="method-note">' +
      icon("info") +
      "<span>排序综合主题匹配、季节窗口、完整预算、交通与酒店质量。价格、秋色阶段与库存均需接入实时数据后再次核验。</span>" +
      "</div>" +
      "</div>"
    );
  }

  function bestHotelForDestination(destination) {
    const inBudget = [];
    const overBudget = [];
    LOGIC.hotelsFor(destination.id).forEach((hotel) => {
      const cost = LOGIC.calculateTripCost(destination, hotel, state.params);
      const item = { hotel, cost };
      if (!state.params.budget || cost.total <= state.params.budget) {
        inBudget.push(item);
      } else {
        overBudget.push(item);
      }
    });
    const score = (item) => {
      const distance = Number(item.hotel.distanceFromCenterKm);
      const distancePenalty = Number.isFinite(distance)
        ? Math.min(12, Math.max(0, distance - 6) / 5)
        : 0;
      return item.hotel.quality - distancePenalty + (item.cost.priceKnown ? 0.8 : 0);
    };
    inBudget.sort((a, b) => score(b) - score(a) || a.cost.total - b.cost.total);
    overBudget.sort((a, b) => score(b) - score(a) || a.cost.total - b.cost.total);
    return inBudget[0] || overBudget[0] || null;
  }

  function plannerDistinctivenessBoost(hotel, facilities) {
    const text = [
      hotel.name,
      hotel.nameEn,
      hotel.brand,
      hotel.intro,
      (hotel.tags || []).join(" "),
      (hotel.highlights || []).join(" "),
      facilities
    ]
      .filter(Boolean)
      .join(" ");
    let boost = 0;
    if (
      /Design Hotels|设计酒店|豪华精选|臻品之选|傲途格|艾迪逊|W 酒店|W酒店|丽思卡尔顿隐世|宝格丽/.test(
        text
      )
    ) {
      boost += 14;
    }
    const localSignals = (
      text.match(
        /古城|古镇|老街|历史建筑|园林|庭院|湖畔|湖景|海景|雪山|山谷|温泉|岛屿|森林|书院|文化|当地|在地|艺术|设计|精品|度假|庄园|隐奢/g
      ) || []
    );
    boost += Math.min(10, new Set(localSignals).size * 2);
    if (
      ["万枫", "福朋喜来登", "万怡", "AC 酒店", "Moxy", "雅乐轩"].includes(
        hotel.brand
      )
    ) {
      boost -= 3;
    }
    return boost;
  }

  function plannerHotelCandidates(destination, draft) {
    const budget = Number(draft && draft.budget) || 0;
    const notes = String((draft && draft.notes) || "");
    const travelStyle =
      draft && draft.travelStyle === "distinctive" ? "distinctive" : "balanced";
    const nightlyLimitMatch = notes.match(
      /(?:每晚|住宿|酒店)[^0-9]{0,8}(\d{3,5})/
    );
    const nightlyLimit = nightlyLimitMatch
      ? Number(nightlyLimitMatch[1])
      : null;
    const params = {
      departure: draft.origin || "上海",
      days: Number(draft.days) || 3,
      people: Number(draft.people) || 2,
      rooms: 1,
      budget
    };
    return LOGIC.hotelsFor(destination.id)
      .map((hotel) => {
        const cost = LOGIC.calculateTripCost(destination, hotel, params);
        const insight = hotelInsightCache[hotel.id] || null;
        const facilities = JSON.stringify(
          (insight && insight.facilities) || {}
        );
        const distance = Number(hotel.distanceFromCenterKm);
        let noteBoost = 0;
        if (
          /亲子|孩子|儿童/.test(notes) &&
          (hotel.suitable || []).includes("亲子")
        ) {
          noteBoost += 7;
        }
        if (/泳池/.test(notes) && /泳池/.test(facilities)) noteBoost += 6;
        if (/酒廊|行政/.test(notes) && /酒廊/.test(facilities)) noteBoost += 6;
        if (/早餐/.test(notes) && /早餐/.test(facilities)) noteBoost += 3;
        if (/地铁|交通|少走/.test(notes) && Number.isFinite(distance)) {
          noteBoost += Math.max(0, 6 - Math.min(6, distance / 2));
        }
        if (/安静/.test(notes) && /(安静|隔音)/.test(hotel.intro || "")) {
          noteBoost += 4;
        }
        if (/奢华|度假|品质/.test(notes) && hotel.brandTier === "奢华") {
          noteBoost += 5;
        }
        if (
          nightlyLimit &&
          Number.isFinite(Number(hotel.price))
        ) {
          noteBoost += Number(hotel.price) <= nightlyLimit ? 7 : -10;
        }
        const distinctiveBoost =
          travelStyle === "distinctive"
            ? plannerDistinctivenessBoost(hotel, facilities)
            : 0;
        const ratio = budget ? cost.total / budget : 0.8;
        const budgetScore = budget
          ? ratio <= 1
            ? Math.max(0.25, 1 - ratio)
            : -Math.min(4, (ratio - 1) * 5)
          : 0.5;
        const distancePenalty = Number.isFinite(distance)
          ? Math.min(10, Math.max(0, distance - 6) / 5)
          : 0;
        return {
          hotel,
          cost,
          withinBudget: !budget || cost.total <= budget,
          noteBoost,
          distinctiveBoost,
          score:
            (Number(hotel.quality) || 7) * 6 +
            budgetScore * 22 +
            noteBoost +
            distinctiveBoost +
            (cost.priceKnown ? 3 : 0) -
            distancePenalty
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.noteBoost - a.noteBoost ||
          a.cost.total - b.cost.total
      );
  }

  function plannerTotalCost(cost, transport, people) {
    if (
      transport &&
      Number.isFinite(Number(transport.price)) &&
      Number(transport.price) > 0
    ) {
      return (
        cost.total -
        cost.transport +
        Number(transport.price) * Math.max(1, Number(people) || 1) * 2
      );
    }
    return cost.total;
  }

  function renderDestination() {
    const destination = LOGIC.getDestination(state.selectedDestinationId);
    if (!destination) {
      state.route = "home";
      return renderHome();
    }
    const hotels = LOGIC.hotelsFor(destination.id);
    const picked = bestHotelForDestination(destination);
    const managementText = LOGIC.managementSummary(destination.id);
    return (
      '<div class="screen">' +
      '<div class="back-row"><button class="back-button" data-action="go-back">' +
      icon("arrowLeft") +
      '返回方案</button><span class="micro muted">2026 · ' +
      state.params.month +
      " 月</span></div>" +
      '<section class="destination-hero accent-' +
      esc(destination.accent) +
      '">' +
      '<span class="eyebrow">' +
      esc(destination.province) +
      " · Autumn edit</span>" +
      "<h1>" +
      esc(destination.name) +
      "</h1>" +
      '<p class="tagline">' +
      esc(destination.tagline) +
      "</p>" +
      '<p class="description">' +
      esc(destination.description) +
      "</p>" +
      '<div class="season-panel"><div><strong>' +
      esc(destination.bestWindow) +
      " · " +
      esc(destination.seasonLabel) +
      "</strong><span>" +
      esc(LOGIC.seasonStatus(destination, Number(state.params.month)).label) +
      " · 季节置信度 " +
      esc(destination.seasonConfidence) +
      " · 依据往期规律</span></div><em>查看行程 ↓</em></div>" +
      "</section>" +
      (picked
        ? '<section class="detail-section card">' +
          '<div class="section-head"><div><h2>预算先算清</h2><p>当前条件的完整估算</p></div>' +
          '<button class="section-link" data-action="view-hotel" data-id="' +
          esc(picked.hotel.id) +
          '">酒店详情 →</button></div>' +
          '<div class="budget-row" style="margin-top:0;padding-top:0;border-top:0">' +
          '<div class="budget-main"><strong>' +
          money(picked.cost.total) +
          "</strong><span>含交通、住宿、餐饮、市内交通和门票" +
          (picked.cost.priceKnown ? "" : "；住宿按品牌档次估算") +
          "</span></div>" +
          '<span class="budget-status ' +
          (picked.cost.difference >= 0 ? "" : "over") +
          '">' +
          (picked.cost.difference >= 0
            ? "预算内"
            : "超预算 " + money(Math.abs(picked.cost.difference))) +
          "</span></div>" +
          '<div class="inline-chips" style="margin-top:12px">' +
          '<span class="inline-chip">交通 ' +
          money(picked.cost.transport) +
          "</span>" +
          '<span class="inline-chip">住宿 ' +
          money(picked.cost.lodging) +
          "</span>" +
          '<span class="inline-chip">餐饮 ' +
          money(picked.cost.food) +
          "</span>" +
          '<span class="inline-chip">市内与门票 ' +
          money(picked.cost.local + picked.cost.tickets) +
          "</span>" +
          "</div>" +
          "</section>"
        : "") +
      '<section class="section">' +
      '<div class="section-head"><div><h2>去哪里看秋色</h2><p>按体力与交通选，不用全打卡</p></div></div>' +
      '<div class="content-card card"><div class="spot-list">' +
      destination.spots
        .map((spot, index) => {
          return (
            '<div class="spot-item">' +
            '<span class="spot-index">0' +
            (index + 1) +
            "</span>" +
            "<div><strong>" +
            esc(spot.name) +
            "</strong><p>" +
            esc(spot.note) +
            "</p></div>" +
            "<span>" +
            esc(spot.transfer) +
            "<br />步行 " +
            esc(spot.walk) +
            "</span>" +
            "</div>"
          );
        })
        .join("") +
      "</div></div></section>" +
      '<section class="section">' +
      '<div class="section-head"><div><h2>' +
      state.params.days +
      ' 天怎么排</h2><p>每天只留一个重点</p></div></div>' +
      '<div class="itinerary-list">' +
      destination.itinerary
        .slice(0, state.params.days)
        .map((day, index) => {
          return (
            '<article class="itinerary-card"><span class="day">' +
            (index + 1) +
            "</span><strong>" +
            esc(day.title) +
            "</strong><ul>" +
            day.items
              .map((item) => "<li>" + esc(item) + "</li>")
              .join("") +
            "</ul></article>"
          );
        })
        .join("") +
      "</div></section>" +
      '<section class="section">' +
      '<div class="section-head"><div><h2>酒店选择</h2><p>' +
      hotels.length +
      " 家万豪系 · 全部管理模式均纳入</p></div>" +
      '<button class="section-link" data-action="open-destination-map" data-id="' +
      esc(destination.id) +
      '">地图看价 →</button></div>' +
      '<div class="hotel-list">' +
      hotels
        .sort((a, b) => (a.price || 99999) - (b.price || 99999))
        .map((hotel) => hotelCard(hotel))
        .join("") +
      "</div>" +
      '<div class="management-note">' +
      icon("info") +
      "<span>当前管理模式：" +
      esc(managementText) +
      "。价格与房型请以下单页或酒店确认为准。</span>" +
      "</div></section>" +
      '<section class="section">' +
      '<div class="section-head"><div><h2>先把风险说清楚</h2><p>比攻略更有用</p></div></div>' +
      destination.warnings
        .map((warning) => {
          return '<div class="warning-card"><strong>' + icon("alert") + " 注意</strong>" + esc(warning) + "</div>";
        })
        .join("") +
      '<div class="warning-card" style="background:rgba(231,237,229,.65);border-color:rgba(102,126,104,.15);color:#435845"><strong>雨天备选</strong>' +
      esc(destination.rainPlan) +
      "</div></section>" +
      "</div>"
    );
  }

  function hotelCard(hotel, compact) {
    const visualStyle = hasPropertyPhoto(hotel)
      ? ' style="background-image:linear-gradient(180deg,rgba(9,23,37,.05),rgba(9,23,37,.55)),url(&quot;' +
        esc(hotel.imageUrl) +
        '&quot;);background-size:cover;background-position:center"'
      : "";
    return (
      '<article class="hotel-card">' +
      '<div class="hotel-visual"' +
      visualStyle +
      "><span>" +
      esc(hotel.brand) +
      "</span></div>" +
      '<div class="hotel-copy"><strong>' +
      esc(hotel.name) +
      "</strong><p>" +
      esc(hotel.area) +
      (Number.isFinite(Number(hotel.distanceFromCenterKm))
        ? " · 距中心 " + hotel.distanceFromCenterKm + " km"
        : "") +
      (Number.isFinite(Number(hotel.addressDistanceKm))
        ? " · 距地址 " + Number(hotel.addressDistanceKm).toFixed(1) + " km"
        : "") +
      " · 质量指数 " +
      esc(qualityLabel(hotel)) +
      "</p>" +
      modeTag(hotel.mode) +
      (pointsValueLabel(hotel)
        ? '<p class="hotel-points-value">' +
          esc(pointsValueLabel(hotel)) +
          "</p>"
        : "") +
      (pointsPromotionLabel(hotel)
        ? '<p class="hotel-points-promotion">' +
          esc(pointsPromotionLabel(hotel)) +
          "</p>"
        : "") +
      "</div>" +
      '<div class="hotel-price"><strong>' +
      esc(priceLabel(hotel)) +
      "</strong><span>" +
      (hasPrice(hotel) ? priceSourceLabel(hotel) + " / 晚" : "官方渠道查价") +
      "</span>" +
      (Number(hotel.pointsPrice) > 0
        ? '<span class="hotel-points-price">' +
          esc(pointsLabel(hotel)) +
          " 积分房</span>"
        : "") +
      "<br />" +
      '<button data-action="view-hotel" data-id="' +
      esc(hotel.id) +
      '">详情 →</button>' +
      (!hasPrice(hotel)
        ? '<button data-action="lookup-hotel-price" data-id="' +
          esc(hotel.id) +
          '">查价</button>'
        : "") +
      "</div>" +
      "</article>"
    );
  }

  function renderMapArt() {
    return (
      '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
      '<rect width="100" height="100" fill="#e2e7dc"/>' +
      '<path class="map-green" d="M0 10 C18 3,29 17,44 12 C58 7,73 4,100 15 L100 31 C76 27,61 36,44 30 C27 25,15 31,0 38 Z"/>' +
      '<path class="map-water" d="M-10 72 C13 63,25 72,37 77 C51 83,66 78,110 68 L110 100 L-10 100 Z"/>' +
      '<path class="map-water" d="M-3 53 C18 51,24 59,31 64 C38 70,48 69,58 64" fill="none" stroke="#c9d9dc" stroke-width="4.5"/>' +
      '<path class="map-road" d="M-8 44 C19 40,32 49,46 53 C61 58,78 50,108 38"/>' +
      '<path class="map-road" d="M27 -10 C31 14,27 34,36 52 C44 70,47 82,43 110"/>' +
      '<path class="map-road" d="M68 -10 C61 10,66 28,63 46 C59 69,67 85,77 110"/>' +
      '<path class="map-road minor" d="M-6 22 C23 20,42 25,68 22 C82 20,92 22,106 26"/>' +
      '<path class="map-road minor" d="M-8 60 C16 57,33 61,51 58 C68 54,85 58,108 53"/>' +
      '<path class="map-road minor" d="M15 -10 C19 19,16 37,19 58 C22 81,18 92,17 110"/>' +
      '<path class="map-road minor" d="M86 -10 C81 19,87 34,84 55 C81 75,88 91,90 110"/>' +
      '<circle cx="35" cy="64" r="2.3" fill="#a6b8aa"/>' +
      '<circle cx="54" cy="35" r="1.8" fill="#a6b8aa"/>' +
      '<circle cx="76" cy="63" r="2.1" fill="#a6b8aa"/>' +
      "</svg>"
    );
  }

  function renderMap() {
    const destination = LOGIC.getDestination(state.mapCity) || DATA.destinations[0];
    const band = MAP_BANDS.find((item) => item.id === state.mapBand) || MAP_BANDS[0];
    let hotels = LOGIC.hotelsFor(destination.id).filter(band.test);
    const selected =
      hotels.find((hotel) => hotel.id === state.mapSelectedHotelId) || hotels[0] || null;
    return (
      '<div class="screen">' +
      '<div class="section-head"><div><h1 class="page-title">酒店地图</h1><p class="page-subtitle">按位置与价位快速缩小范围</p></div>' +
      '<button class="icon-button" data-action="go-rankings" aria-label="查看酒店榜单">' +
      icon("chart") +
      "</button></div>" +
      '<div class="map-toolbar">' +
      DATA.destinations
        .map((item) => {
          return (
            '<button class="city-tab ' +
            (item.id === destination.id ? "is-active" : "") +
            '" data-action="set-map-city" data-id="' +
            esc(item.id) +
            '">' +
            esc(item.name) +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="map-frame">' +
      '<div class="map-art">' +
      renderMapArt() +
      "</div>" +
      '<span class="map-note">1 人含税示例 · 区位示意</span>' +
      '<span class="map-label park">城市绿肺</span>' +
      '<span class="map-label center">' +
      esc(destination.name) +
      "核心区</span>" +
      '<span class="map-label station">车站方向</span>' +
      hotels
        .map((hotel) => {
          return (
            '<button class="price-pin ' +
            (selected && selected.id === hotel.id ? "is-selected" : "") +
            '" style="left:' +
            hotel.coords.x +
            "%;top:" +
            hotel.coords.y +
            '%;" data-action="select-map-hotel" data-id="' +
            esc(hotel.id) +
            '" aria-label="' +
            esc(hotel.name + "，示例价 " + money(hotel.price)) +
            '"><span class="price-pin-label">' +
            money(hotel.price) +
            '</span><i class="price-pin-dot"></i></button>'
          );
        })
        .join("") +
      (selected
        ? '<div class="map-selected">' +
          "<div><strong>" +
          esc(selected.name) +
          "</strong><p>" +
          esc(selected.area) +
          (selected.mode === "unverified"
            ? ""
            : " · " + esc(DATA.managementModes[selected.mode])) +
          " · 质量 " +
          qualityLabel(selected) +
          "</p></div>" +
          '<div class="map-selected-actions">' +
          '<button data-action="toggle-favorite" data-id="' +
          esc(selected.id) +
          '" aria-label="收藏酒店">' +
          icon(favorites.has(selected.id) ? "heartFill" : "heart") +
          "</button>" +
          '<button data-action="view-hotel" data-id="' +
          esc(selected.id) +
          '" aria-label="查看酒店详情">' +
          icon("arrowRight") +
          "</button>" +
          "</div></div>"
        : '<div class="map-selected"><div><strong>当前筛选没有酒店</strong><p>放宽价位或品牌后再试。</p></div></div>') +
      "</div>" +
      '<div class="filter-row">' +
      MAP_BANDS.map((item) => {
        return (
          '<button class="filter-chip ' +
          (state.mapBand === item.id ? "is-active" : "") +
          '" data-action="set-map-band" data-id="' +
          item.id +
          '">' +
          item.label +
          "</button>"
        );
      }).join("") +
      "</div>" +
      '<section class="section">' +
      '<div class="section-head"><div><h2>' +
      esc(destination.name) +
      "住宿短名单</h2><p>" +
      hotels.length +
      " 家符合当前筛选 · 2026-10-19 内置样例价</p></div></div>" +
      (hotels.length
        ? '<div class="hotel-list">' +
          hotels
            .slice()
            .sort((a, b) => a.price - b.price)
            .map((hotel) => hotelCard(hotel))
            .join("") +
          "</div>"
        : emptyState(
            "没有符合条件的酒店",
            "当前筛选没有匹配记录，请放宽品牌或价位条件。",
            "查看全部价位",
            "reset-map-filters"
          )) +
      "</section>" +
      "</div>"
    );
  }

  function mapCityOptions(selectedId) {
    const groups = {};
    DATA.destinations.forEach((destination) => {
      const region = destination.region || "其他";
      if (!groups[region]) groups[region] = [];
      groups[region].push(destination);
    });
    return DATA.regions
      .filter((region) => region !== "全国")
      .filter((region) => groups[region] && groups[region].length)
      .map((region) => {
        return (
          '<optgroup label="' +
          esc(region) +
          '">' +
          groups[region]
            .map((destination) => {
              return (
                '<option value="' +
                esc(destination.id) +
                '"' +
                (destination.id === selectedId ? " selected" : "") +
                ">" +
                esc(destination.name) +
                " · " +
                destination.hotelCount +
                " 家</option>"
              );
            })
            .join("") +
          "</optgroup>"
        );
      })
      .join("");
  }

  function addressDistanceForHotel(hotel) {
    if (
      !state.mapAddressLocation ||
      !hotel ||
      !hotel.coords ||
      !Number.isFinite(Number(hotel.coords.longitude)) ||
      !Number.isFinite(Number(hotel.coords.latitude))
    ) {
      return null;
    }
    return plannerStraightLineKm(
      [
        state.mapAddressLocation.longitude,
        state.mapAddressLocation.latitude
      ],
      [hotel.coords.longitude, hotel.coords.latitude]
    );
  }

  function applyMapAddressFilter(hotels) {
    if (!state.mapAddressLocation) return hotels;
    const withDistance = hotels
      .map((hotel) =>
        Object.assign({}, hotel, {
          addressDistanceKm: addressDistanceForHotel(hotel)
        })
      )
      .filter(
        (hotel) =>
          hotel.addressDistanceKm != null &&
          Number.isFinite(Number(hotel.addressDistanceKm))
      )
      .sort(
        (a, b) =>
          a.addressDistanceKm - b.addressDistanceKm ||
          b.quality - a.quality
      );
    const nearby = withDistance.filter(
      (hotel) => hotel.addressDistanceKm <= MAP_ADDRESS_RADIUS_KM
    );
    return nearby.length ? nearby : withDistance.slice(0, 8);
  }

  async function searchMapAddress() {
    const input = document.getElementById("map-address-input");
    const address = input ? input.value.trim() : state.mapAddress;
    if (!address) {
      clearMapAddress();
      return;
    }
    const destination = LOGIC.getDestination(state.mapCity);
    if (!destination) return;
    state.mapAddressLoading = true;
    const button = document.querySelector("#map-address-form button[type='submit']");
    if (button) {
      button.disabled = true;
      button.textContent = "定位中…";
    }
    try {
      let location = null;
      let label = address;
      try {
        const geocode = await requestAmap("geocode/geo", {
          address,
          city: destination.name
        });
        const result = geocode.geocodes && geocode.geocodes[0];
        if (result && result.location) {
          const parts = result.location.split(",").map(Number);
          if (Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
            location = { longitude: parts[0], latitude: parts[1] };
            label = result.formatted_address || address;
          }
        }
      } catch (error) {
        // Fall back to POI text search for landmarks and business districts.
      }
      if (!location) {
        const places = await requestAmap("place/text", {
          keywords: address,
          city: destination.name,
          citylimit: "true",
          offset: "1",
          page: "1",
          extensions: "base"
        });
        const poi = places.pois && places.pois[0];
        if (poi && poi.location) {
          const parts = poi.location.split(",").map(Number);
          if (Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
            location = { longitude: parts[0], latitude: parts[1] };
            label = [poi.name, poi.address].filter(Boolean).join(" · ");
          }
        }
      }
      if (!location) {
        throw new Error("高德没有找到这个地址，请填写更具体的商圈或门牌");
      }
      state.mapAddress = address;
      state.mapAddressLabel = label;
      state.mapAddressLocation = location;
      state.mapAddressLoading = false;
      state.mapSelectedHotelId = null;
      state.mapZoom = null;
      state.mapCenter = null;
      state.mapViewCity = null;
      replaceHistorySnapshot();
      render();
      showToast("已展示地址附近的万豪系酒店");
    } catch (error) {
      state.mapAddressLoading = false;
      showToast(error.message || "地址搜索失败");
      render();
    }
  }

  function clearMapAddress() {
    state.mapAddress = "";
    state.mapAddressLabel = "";
    state.mapAddressLocation = null;
    state.mapAddressLoading = false;
    state.mapSelectedHotelId = null;
    state.mapZoom = null;
    state.mapCenter = null;
    state.mapViewCity = null;
    replaceHistorySnapshot();
    render();
  }

  function renderRealMap() {
    const destination =
      LOGIC.getDestination(state.mapCity) || DATA.destinations[0] || null;
    if (!destination) {
      return emptyState(
        "酒店目录为空",
        "当前没有可显示的酒店。请检查目录数据或联网更新。",
        "返回规划",
        "go-home"
      );
    }
    const band = MAP_BANDS.find((item) => item.id === state.mapBand) || MAP_BANDS[0];
    const cityHotels = LOGIC.hotelsFor(destination.id);
    const brands = Array.from(new Set(cityHotels.map((hotel) => hotel.brand))).sort(
      (a, b) => a.localeCompare(b, "zh-CN")
    );
    let hotels = cityHotels.filter(band.test);
    if (state.mapBrand !== "all") {
      hotels = hotels.filter((hotel) => hotel.brand === state.mapBrand);
    }
    if (state.mapQuery.trim()) {
      const query = state.mapQuery.trim().toLowerCase();
      hotels = hotels.filter((hotel) => {
        return (
          String(hotel.name || "").toLowerCase().includes(query) ||
          String(hotel.nameEn || "").toLowerCase().includes(query) ||
          String(hotel.brand || "").toLowerCase().includes(query)
        );
      });
    }
    hotels = applyMapAddressFilter(hotels);
    hotels = hotels
      .slice()
      .sort((a, b) => {
        if (state.mapAddressLocation) {
          return (
            Number(a.addressDistanceKm) - Number(b.addressDistanceKm) ||
            b.quality - a.quality
          );
        }
        return (
          (a.distanceFromCenterKm || 9999) - (b.distanceFromCenterKm || 9999) ||
          b.quality - a.quality
        );
      });
    const selected =
      hotels.find((hotel) => hotel.id === state.mapSelectedHotelId) || hotels[0] || null;
    const visibleHotels = hotels.slice(0, state.mapVisible);
    const pricedCount = hotels.filter((hotel) => hasPrice(hotel)).length;
    const pointsPromotionCount = hotels.filter((hotel) =>
      Boolean(pointsPromotionForHotel(hotel))
    ).length;
    const missingPriceCount = cityHotels.filter((hotel) => !hasPrice(hotel)).length;
    const selectedValueLabel = selected ? pointsValueLabel(selected) : "";
    const addressFallback =
      Boolean(state.mapAddressLocation) &&
      hotels.length > 0 &&
      hotels.every(
        (hotel) => Number(hotel.addressDistanceKm) > MAP_ADDRESS_RADIUS_KM
      );

    return (
      '<div class="screen">' +
      '<div class="section-head"><div><h1 class="page-title">酒店地图</h1><p class="page-subtitle">全国 ' +
      DATA.hotels.length +
      " 家 · " +
      DATA.destinations.length +
      " 城 · 真实地图</p></div>" +
      '<button class="icon-button" data-action="go-rankings" aria-label="查看酒店榜单">' +
      icon("chart") +
      "</button></div>" +
      '<section class="card city-picker">' +
      '<label class="field"><span>选择城市（按区域分组）</span><select id="map-city-select">' +
      mapCityOptions(destination.id) +
      "</select></label>" +
      '<div class="city-summary"><span>' +
      esc(destination.region || "") +
      " · " +
      esc(destination.province || "") +
      "</span><strong>" +
      cityHotels.length +
      " 家万豪系</strong><span>" +
      pricedCount +
      " 家已有报价" +
      (missingPriceCount ? " · " + missingPriceCount + " 家待补" : "") +
      (pointsPromotionCount
        ? "</span><strong>" + pointsPromotionCount + " 家积分闪促</strong>"
        : "</span>") +
      "</div>" +
      "</section>" +
      '<section class="card map-address-card">' +
      '<form id="map-address-form" class="map-address-form">' +
      '<label class="field"><span>按地址查找附近万豪酒店</span><div class="map-address-row"><input id="map-address-input" value="' +
      esc(state.mapAddress) +
      '" placeholder="输入酒店、商圈、景点或完整地址，例如：上海外滩" autocomplete="off" /><button class="btn btn-primary" type="submit"' +
      (state.mapAddressLoading ? " disabled" : "") +
      ">" +
      icon("search") +
      (state.mapAddressLoading ? "定位中…" : "找附近酒店") +
      "</button></div></label>" +
      "</form>" +
      (state.mapAddressLocation
        ? '<div class="map-address-result"><span>' +
          icon("locate") +
          "<strong>" +
          esc(state.mapAddressLabel || state.mapAddress) +
          "</strong><em>" +
          (addressFallback
            ? MAP_ADDRESS_RADIUS_KM +
              " km 内没有万豪系，显示最近 " +
              hotels.length +
              " 家"
            : "展示 " +
              MAP_ADDRESS_RADIUS_KM +
              " km 内 " +
              hotels.length +
              " 家万豪系") +
          "</em></span><button type=\"button\" data-action=\"clear-map-address\">清除</button></div>"
        : '<p class="micro muted map-address-hint">地址会先用高德地理编码，找不到时再用地标 POI 搜索。附近范围按直线约 ' +
          MAP_ADDRESS_RADIUS_KM +
          " km 计算。</p>") +
      "</section>" +
      '<div class="map-frame real-map-frame">' +
      '<div id="amap-map" class="amap-map" aria-label="' +
      esc(destination.name) +
      '万豪酒店地图"></div>' +
      '<span class="map-note">高德地图 · 联网加载 · 官方酒店坐标</span>' +
      '<button type="button" class="map-locate-button ' +
      (state.mapLocationLoading ? "is-loading" : "") +
      '" data-action="locate-map" aria-label="定位我的当前位置" title="定位当前位置">' +
      icon("locate") +
      "</button>" +
      (selected
        ? '<div class="map-selected">' +
          "<div><strong>" +
          esc(selected.name) +
          "</strong><p>" +
          esc(selected.brand) +
          (selected.mode === "unverified"
            ? ""
            : " · " + esc(DATA.managementModes[selected.mode])) +
          (Number.isFinite(Number(selected.addressDistanceKm))
            ? " · 距地址 " +
              Number(selected.addressDistanceKm).toFixed(1) +
              " km"
            : "") +
          (Number.isFinite(Number(selected.distanceFromCenterKm))
            ? " · 距中心 " + selected.distanceFromCenterKm + " km"
            : "") +
          " · " +
          (hasPrice(selected)
            ? money(selected.price) + " · " + priceSourceLabel(selected)
            : "官方渠道查价") +
          (Number(selected.pointsPrice) > 0
            ? " · " + pointsLabel(selected) + " 积分房"
            : "") +
          "</p>" +
          (selectedValueLabel
            ? '<p class="map-points-value">' +
              icon("wallet") +
              esc(selectedValueLabel) +
              "</p>"
            : "") +
          (pointsPromotionLabel(selected)
            ? '<p class="map-points-promotion">' +
              icon("spark") +
              esc(pointsPromotionLabel(selected)) +
              "</p>"
            : "") +
          "</div>" +
          '<div class="map-selected-actions">' +
          '<button data-action="toggle-favorite" data-id="' +
          esc(selected.id) +
          '" aria-label="收藏酒店">' +
          icon(favorites.has(selected.id) ? "heartFill" : "heart") +
          "</button>" +
          '<button data-action="view-hotel" data-id="' +
          esc(selected.id) +
          '" aria-label="查看酒店详情">' +
          icon("arrowRight") +
          "</button>" +
          "</div></div>"
        : '<div class="map-selected"><div><strong>当前筛选没有酒店</strong><p>放宽筛选后再试。</p></div></div>') +
      "</div>" +
      '<div class="map-filter-card card">' +
      '<form id="map-search-form" class="map-search-form">' +
      '<input id="map-query-input" value="' +
      esc(state.mapQuery) +
      '" placeholder="搜索酒店名称" aria-label="搜索酒店名称" />' +
      '<button class="btn btn-secondary" type="submit">筛选</button>' +
      "</form>" +
      '<div class="filter-row">' +
      MAP_BANDS.map((item) => {
        return (
          '<button class="filter-chip ' +
          (state.mapBand === item.id ? "is-active" : "") +
          '" data-action="set-map-band" data-id="' +
          item.id +
          '">' +
          item.label +
          "</button>"
        );
      }).join("") +
      "</div>" +
      '<div class="filter-select-grid">' +
      '<label class="field"><span>品牌</span><select id="map-brand">' +
      '<option value="all"' +
      (state.mapBrand === "all" ? " selected" : "") +
      ">全部品牌</option>" +
      brands
        .map(
          (brand) =>
            '<option value="' +
            esc(brand) +
            '"' +
            (state.mapBrand === brand ? " selected" : "") +
            ">" +
            esc(brand) +
            "</option>"
        )
        .join("") +
      "</select></label>" +
      '<label class="field"><span>入住日期（查 1 晚）</span><input id="map-checkin" type="date" min="' +
      defaultTravelDate(0) +
      '" value="' +
      esc(state.mapCheckIn || defaultTravelDate(1)) +
      '" /></label>' +
      "</div>" +
      '<div class="btn-row" style="margin-top:10px">' +
      '<button class="btn btn-gold"' +
      (state.flyAi.status === "loading" ? " disabled" : "") +
      ' data-action="refresh-flyai-prices" data-id="' +
      esc(destination.id) +
      '">' +
      icon("spark") +
      (state.flyAi.status === "loading" ? "飞猪查价中…" : "飞猪实时查价") +
      "</button>" +
      '<button class="btn btn-secondary"' +
      (state.sync.status === "loading" ? " disabled" : "") +
      ' data-action="refresh-city-prices" data-id="' +
      esc(destination.id) +
      '">' +
      icon("source") +
      (state.sync.status === "loading"
        ? "正在联网更新…"
        : "官网更新") +
      "</button></div>" +
      (state.flyAi.message
        ? '<p class="micro muted" style="margin:9px 0 0">' +
          esc(state.flyAi.message) +
          "</p>"
        : "") +
      (missingPriceCount
        ? '<button class="btn btn-secondary btn-block" style="margin-top:8px"' +
          (state.flyAiFill.active ? " disabled" : "") +
          ' data-action="fill-missing-flyai-prices" data-id="' +
          esc(destination.id) +
          '">' +
          icon("search") +
          (state.flyAiFill.active
            ? "正在逐家补价…"
            : "逐家补齐 " + missingPriceCount + " 家缺失房价") +
          "</button>" +
          '<p class="micro muted" id="flyai-fill-status" style="margin:7px 0 0">' +
          esc(
            state.flyAiFill.active
              ? "正在补价 " +
                  (state.flyAiFill.done + 1) +
                  "/" +
                  state.flyAiFill.total +
                  " · " +
                  state.flyAiFill.current
              : ""
          ) +
          "</p>"
        : "") +
      (state.sync.message
        ? '<p class="micro muted" style="margin:9px 0 0">' +
          esc(state.sync.message) +
          "</p>"
        : "") +
      "</div>" +
      '<section class="section">' +
      '<div class="section-head"><div><h2>' +
      (state.mapAddressLocation
        ? esc(state.mapAddressLabel || state.mapAddress) + "附近万豪系"
        : esc(destination.name) + "住宿短名单") +
      "</h2><p>" +
      hotels.length +
      " 家符合筛选 · " +
      (state.mapAddressLocation ? "按距地址排序" : "按距市中心排序") +
      '</p></div><span class="micro muted">' +
      (pricedCount ? "含税报价 " + pricedCount + " 家" : "暂无报价") +
      "</span></div>" +
      (visibleHotels.length
        ? '<div class="hotel-list">' +
          visibleHotels.map((hotel) => hotelCard(hotel)).join("") +
          "</div>"
        : emptyState(
            "没有符合条件的酒店",
            "当前筛选没有结果，请放宽品牌或价位条件。",
            "清除筛选",
            "reset-map-filters"
          )) +
      (hotels.length > visibleHotels.length
        ? '<button class="btn btn-secondary btn-block" style="margin-top:12px" data-action="load-more-map">再显示 ' +
          Math.min(24, hotels.length - visibleHotels.length) +
          " 家</button>"
        : "") +
      '<div class="management-note">' +
      icon("info") +
      "<span>价格口径：飞猪返回的是所选入住日的公开起价，万豪官方查询是 1 位成人含税最低房价；两者都不是锁价，房型、税费和库存以下单页为准。没有取到报价的酒店显示“查价”。地图由高德提供。</span>" +
      "</div></section></div>"
    );
  }

  function initLeafletMap() {
    const container = document.getElementById("leaflet-map");
    if (!container) return;
    if (!window.L) {
      container.innerHTML =
        '<div class="map-load-error">地图组件未加载，请重新打开应用。</div>';
      return;
    }
    if (leafletMap) {
      leafletMap.remove();
      leafletMap = null;
    }
    const destination = LOGIC.getDestination(state.mapCity);
    if (!destination) return;
    const band = MAP_BANDS.find((item) => item.id === state.mapBand) || MAP_BANDS[0];
    let hotels = LOGIC.hotelsFor(destination.id).filter(band.test);
    if (state.mapBrand !== "all") {
      hotels = hotels.filter((hotel) => hotel.brand === state.mapBrand);
    }
    if (state.mapQuery.trim()) {
      const query = state.mapQuery.trim().toLowerCase();
      hotels = hotels.filter(
        (hotel) =>
          String(hotel.name || "").toLowerCase().includes(query) ||
          String(hotel.nameEn || "").toLowerCase().includes(query) ||
          String(hotel.brand || "").toLowerCase().includes(query)
      );
    }
    hotels = hotels
      .slice()
      .sort(
        (a, b) =>
          (a.distanceFromCenterKm || 9999) - (b.distanceFromCenterKm || 9999) ||
          b.quality - a.quality
      );
    const center =
      destination.coords && Number.isFinite(destination.coords.latitude)
        ? [destination.coords.latitude, destination.coords.longitude]
        : [35.8617, 104.1954];
    leafletMap = L.map(container, {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true
    }).setView(center, hotels.length ? 11 : 5);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_self">OpenStreetMap</a>'
    }).addTo(leafletMap);

    const bounds = [];
    const selectedHotel =
      hotels.find((hotel) => hotel.id === state.mapSelectedHotelId) || hotels[0] || null;
    hotels.forEach((hotel) => {
      if (!hotel.coords || !Number.isFinite(hotel.coords.latitude)) return;
      const point = [hotel.coords.latitude, hotel.coords.longitude];
      bounds.push(point);
      const selected = Boolean(selectedHotel && selectedHotel.id === hotel.id);
      const marker = L.marker(point, {
        icon: L.divIcon({
          className: "hotel-map-div-icon",
          html:
            '<span class="hotel-map-pin' +
            (selected ? " is-featured" : "") +
            '">' +
            esc(priceLabel(hotel)) +
            "</span>",
          iconSize: null,
          iconAnchor: [26, 18]
        }),
        title: hotel.name
      }).addTo(leafletMap);
      marker.on("click", () => {
        state.mapSelectedHotelId = hotel.id;
        render();
      });
    });
    if (bounds.length > 1) {
      leafletMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    } else if (bounds.length === 1) {
      leafletMap.setView(bounds[0], 13);
    }
    window.setTimeout(() => leafletMap && leafletMap.invalidateSize(), 120);
  }

  function ensureAmap() {
    if (window.AMap) return Promise.resolve(window.AMap);
    if (amapPromise) return amapPromise;
    amapPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://webapi.amap.com/maps?v=2.0&key=" +
        encodeURIComponent(AMAP_KEY) +
        "&plugin=AMap.Scale,AMap.ToolBar,AMap.Geocoder,AMap.PlaceSearch,AMap.Driving";
      script.async = true;
      script.onload = () => {
        if (window.AMap) {
          resolve(window.AMap);
        } else {
          reject(new Error("高德地图 SDK 加载失败"));
        }
      };
      script.onerror = () => reject(new Error("无法连接高德地图服务"));
      document.head.appendChild(script);
    }).catch((error) => {
      amapPromise = null;
      throw error;
    });
    return amapPromise;
  }

  const amapPendingRequests = new Map();
  let amapRequestSequence = 0;

  function amapQuery(params) {
    return Object.keys(params)
      .filter((key) => params[key] !== undefined && params[key] !== null)
      .map(
        (key) =>
          encodeURIComponent(key) + "=" + encodeURIComponent(String(params[key]))
      )
      .join("&");
  }

  function requestAmap(path, params) {
    const query = amapQuery(params);
    if (window.AndroidAmapApi && typeof window.AndroidAmapApi.request === "function") {
      return new Promise((resolve, reject) => {
        const requestId = "amap-" + ++amapRequestSequence;
        const timer = window.setTimeout(() => {
          amapPendingRequests.delete(requestId);
          reject(new Error("高德联网请求超时"));
        }, 25000);
        amapPendingRequests.set(requestId, { resolve, reject, timer });
        try {
          window.AndroidAmapApi.request(requestId, path, query);
        } catch (error) {
          window.clearTimeout(timer);
          amapPendingRequests.delete(requestId);
          reject(error);
        }
      });
    }
    return fetch(
      "https://restapi.amap.com/v3/" +
        path +
        "?" +
        query +
        "&key=" +
        encodeURIComponent(AMAP_KEY)
    )
      .then((response) => {
        if (!response.ok) throw new Error("高德接口 HTTP " + response.status);
        return response.json();
      })
      .then((data) => {
        if (String(data.status) !== "1") {
          throw new Error(data.info || "高德接口返回失败");
        }
        return data;
      });
  }

  window.onNativeAmapResult = function (requestId, body) {
    const pending = amapPendingRequests.get(requestId);
    if (!pending) return;
    window.clearTimeout(pending.timer);
    amapPendingRequests.delete(requestId);
    try {
      const data = JSON.parse(body);
      if (String(data.status) !== "1") {
        throw new Error(data.info || "高德接口返回失败");
      }
      pending.resolve(data);
    } catch (error) {
      pending.reject(error);
    }
  };

  window.onNativeAmapError = function (requestId, message) {
    const pending = amapPendingRequests.get(requestId);
    if (!pending) return;
    window.clearTimeout(pending.timer);
    amapPendingRequests.delete(requestId);
    pending.reject(new Error(message || "高德联网请求失败"));
  };

  function normalizeAmapWeather(payload) {
    const forecast =
      payload && payload.forecasts && payload.forecasts[0]
        ? payload.forecasts[0]
        : null;
    if (!forecast || !Array.isArray(forecast.casts)) return [];
    return forecast.casts.map((cast) => ({
      date: cast.date || "",
      dayWeather: cleanHotelText(cast.dayweather),
      nightWeather: cleanHotelText(cast.nightweather),
      dayTemp: Number(cast.daytemp) || null,
      nightTemp: Number(cast.nighttemp) || null,
      dayWind: cleanHotelText(cast.daywind),
      dayPower: cleanHotelText(cast.daypower),
      source: "高德天气"
    }));
  }

  function weatherForDate(weather, date, index) {
    if (!Array.isArray(weather) || !weather.length) return null;
    return (
      weather.find((item) => item.date === date) ||
      weather[Math.min(index, weather.length - 1)] ||
      null
    );
  }

  function weatherSummary(weather) {
    if (!weather) return "";
    const temperatures =
      weather.dayTemp != null || weather.nightTemp != null
        ? (weather.dayTemp == null ? "" : weather.dayTemp + "°") +
          (weather.nightTemp == null ? "" : " / " + weather.nightTemp + "°")
        : "";
    return [weather.dayWeather, temperatures, weather.dayWind, weather.dayPower]
      .filter(Boolean)
      .join(" · ");
  }

  function hasFlyAiBridge() {
    return Boolean(
      window.AndroidFlyAi &&
        typeof window.AndroidFlyAi.request === "function"
    );
  }

  function flyAiCacheTtl(tool) {
    if (tool === "get_marriott_hotel_info") return 7 * 24 * 60 * 60 * 1000;
    if (tool === "search_domestic_train" || tool === "search_flight") {
      return 12 * 60 * 60 * 1000;
    }
    return 30 * 60 * 1000;
  }

  function readFlyAiCache(tool, args) {
    const key = tool + ":" + JSON.stringify(args || {});
    const entry = flyAiResponseCache[key];
    if (
      !entry ||
      !entry.payload ||
      Date.now() - Number(entry.savedAt || 0) > flyAiCacheTtl(tool)
    ) {
      return null;
    }
    return entry.payload;
  }

  function writeFlyAiCache(tool, args, payload) {
    const key = tool + ":" + JSON.stringify(args || {});
    flyAiResponseCache[key] = {
      savedAt: Date.now(),
      payload
    };
    const entries = Object.entries(flyAiResponseCache)
      .sort((a, b) => Number(b[1].savedAt || 0) - Number(a[1].savedAt || 0))
      .slice(0, 30);
    flyAiResponseCache = Object.fromEntries(entries);
    safeWrite("lvban.flyAiResponseCache.v1", flyAiResponseCache);
  }

  function requestFlyAi(tool, args) {
    const cached = readFlyAiCache(tool, args);
    if (cached) return Promise.resolve(cached);
    if (!hasFlyAiBridge()) {
      return Promise.reject(
        new Error("飞猪联网能力仅在安装后的 Android App 中可用")
      );
    }
    return new Promise((resolve, reject) => {
      const requestId = "flyai-" + ++flyAiRequestSequence;
      const timer = window.setTimeout(() => {
        flyAiPending.delete(requestId);
        reject(new Error("飞猪联网请求超时"));
      }, 65000);
      flyAiPending.set(requestId, {
        resolve,
        reject,
        timer,
        tool,
        args: args || {}
      });
      try {
        window.AndroidFlyAi.request(
          requestId,
          tool,
          JSON.stringify(args || {})
        );
      } catch (error) {
        window.clearTimeout(timer);
        flyAiPending.delete(requestId);
        reject(error);
      }
    });
  }

  window.onNativeFlyAiResult = function (requestId, body) {
    const pending = flyAiPending.get(requestId);
    if (!pending) return;
    window.clearTimeout(pending.timer);
    flyAiPending.delete(requestId);
    try {
      const payload = typeof body === "string" ? JSON.parse(body) : body;
      if (payload && Number(payload.status) && Number(payload.status) !== 0) {
        throw new Error(payload.message || "飞猪接口返回失败");
      }
      writeFlyAiCache(pending.tool, pending.args, payload);
      pending.resolve(payload);
    } catch (error) {
      pending.reject(error);
    }
  };

  window.onNativeFlyAiError = function (requestId, message) {
    const pending = flyAiPending.get(requestId);
    if (!pending) return;
    window.clearTimeout(pending.timer);
    flyAiPending.delete(requestId);
    pending.reject(new Error(message || "飞猪联网请求失败"));
  };

  const meituanPendingRequests = new Map();
  let meituanRequestSequence = 0;

  function parseMeituanGuideText(value) {
    let text = String(value || "")
      .replace(/<\/?answer>/gi, "")
      .replace(/```(?:json)?/gi, "")
      .trim();
    if (!text) throw new Error("美团酒旅 Skill 返回为空");
    try {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end > start) text = text.slice(start, end + 1);
      const parsed = JSON.parse(text);
      const normalizeItems = (items) =>
        (Array.isArray(items) ? items : [])
          .map((item) => ({
            name: cleanHotelText(item && item.name),
            address: cleanHotelText(item && item.address),
            reason: cleanHotelText(item && (item.reason || item.description)),
            cuisine: cleanHotelText(item && item.cuisine),
            category: cleanHotelText(item && item.category)
          }))
          .filter((item) => item.name)
          .slice(0, 6);
      const guide = {
        attractions: normalizeItems(parsed.attractions),
        restaurants: normalizeItems(parsed.restaurants)
      };
      if (!guide.attractions.length && !guide.restaurants.length) {
        throw new Error("美团酒旅 Skill 未返回景点或餐厅");
      }
      return guide;
    } catch (error) {
      throw new Error("美团景点与美食结果格式无法解析");
    }
  }

  function buildMeituanGuideQuery(city, draft, interest) {
    return (
      "请根据真实旅行供给，为" +
      city +
      "推荐最值得去的5个景点和5家本地特色餐厅。" +
      "用户主要兴趣：" +
      (interest && interest.label ? interest.label : draft.interest || "城市漫游") +
      "；旅行节奏：" +
      plannerPaceLabel(draft.pace) +
      "；旅行天数：" +
      draft.days +
      "天；补充需求：" +
      (draft.notes || "无") +
      "。餐厅优先考虑大众点评必吃榜或本地高口碑，只有确认上榜时才标注。" +
      "只输出严格JSON，不要Markdown，不要解释。格式：" +
      '{"attractions":[{"name":"","address":"","reason":""}],"restaurants":[{"name":"","address":"","cuisine":"","reason":""}]}'
    );
  }

  function requestMeituanGuide(cityName, draft, interest) {
    const city = String(cityName || "").trim();
    if (!city) return Promise.reject(new Error("缺少旅行内容查询城市"));
    const query = buildMeituanGuideQuery(city, draft, interest);
    const cacheKey = [
      city,
      draft.days || 3,
      draft.pace || "relaxed",
      interest && interest.label,
      draft.notes || ""
    ].join("|");
    const cached = meituanGuideCache[cacheKey];
    if (
      cached &&
      cached.guide &&
      Date.now() - Number(cached.savedAt || 0) < 7 * 24 * 60 * 60 * 1000
    ) {
      return Promise.resolve(cached.guide);
    }
    if (
      !window.AndroidMeituanTravel ||
      typeof window.AndroidMeituanTravel.query !== "function"
    ) {
      return Promise.reject(new Error("美团景点与美食查询仅在 Android App 中可用"));
    }
    return new Promise((resolve, reject) => {
      const requestId = "meituan-" + ++meituanRequestSequence;
      const timer = window.setTimeout(() => {
        meituanPendingRequests.delete(requestId);
        reject(new Error("美团景点与美食查询超时"));
      }, 130000);
      meituanPendingRequests.set(requestId, {
        resolve,
        reject,
        timer,
        city,
        cacheKey
      });
      try {
        window.AndroidMeituanTravel.query(requestId, city, query);
      } catch (error) {
        window.clearTimeout(timer);
        meituanPendingRequests.delete(requestId);
        reject(error);
      }
    });
  }

  window.onNativeMeituanTravelResult = function (requestId, body) {
    const pending = meituanPendingRequests.get(requestId);
    if (!pending) return;
    window.clearTimeout(pending.timer);
    meituanPendingRequests.delete(requestId);
    try {
      const payload = typeof body === "string" ? JSON.parse(body) : body;
      if (Number(payload.code) !== 0 || !payload.data) {
        throw new Error(payload.msg || "美团酒旅 Skill 没有返回结果");
      }
      const guide = parseMeituanGuideText(payload.data);
      if (pending.cacheKey) {
        meituanGuideCache[pending.cacheKey] = {
          savedAt: Date.now(),
          guide
        };
        meituanGuideCache = Object.fromEntries(
          Object.entries(meituanGuideCache)
            .sort((a, b) => Number(b[1].savedAt || 0) - Number(a[1].savedAt || 0))
            .slice(0, 30)
        );
        safeWrite("lvban.meituanGuideCache.v1", meituanGuideCache);
      }
      pending.resolve(guide);
    } catch (error) {
      pending.reject(error);
    }
  };

  window.onNativeMeituanTravelError = function (requestId, message) {
    const pending = meituanPendingRequests.get(requestId);
    if (!pending) return;
    window.clearTimeout(pending.timer);
    meituanPendingRequests.delete(requestId);
    pending.reject(new Error(message || "美团酒旅 Skill 请求失败"));
  };

  const deepSeekPendingRequests = new Map();
  let deepSeekRequestSequence = 0;

  function requestDeepSeek(prompt) {
    if (
      !window.AndroidDeepSeek ||
      typeof window.AndroidDeepSeek.request !== "function"
    ) {
      return Promise.resolve(null);
    }
    return new Promise((resolve, reject) => {
      const requestId = "deepseek-" + ++deepSeekRequestSequence;
      const timer = window.setTimeout(() => {
        deepSeekPendingRequests.delete(requestId);
        reject(new Error("DeepSeek 请求超时"));
      }, 50000);
      deepSeekPendingRequests.set(requestId, { resolve, reject, timer });
      try {
        window.AndroidDeepSeek.request(requestId, prompt);
      } catch (error) {
        window.clearTimeout(timer);
        deepSeekPendingRequests.delete(requestId);
        reject(error);
      }
    });
  }

  window.onNativeDeepSeekResult = function (requestId, content) {
    const pending = deepSeekPendingRequests.get(requestId);
    if (!pending) return;
    window.clearTimeout(pending.timer);
    deepSeekPendingRequests.delete(requestId);
    pending.resolve(content);
  };

  window.onNativeDeepSeekError = function (requestId, message) {
    const pending = deepSeekPendingRequests.get(requestId);
    if (!pending) return;
    window.clearTimeout(pending.timer);
    deepSeekPendingRequests.delete(requestId);
    pending.reject(new Error(message || "DeepSeek 请求失败"));
  };

  function captureAmapView() {
    if (!amapInstance) return;
    try {
      const zoom = Number(amapInstance.getZoom());
      const center = amapInstance.getCenter();
      if (Number.isFinite(zoom)) state.mapZoom = zoom;
      if (
        center &&
        Number.isFinite(Number(center.lng)) &&
        Number.isFinite(Number(center.lat))
      ) {
        state.mapCenter = {
          longitude: Number(center.lng),
          latitude: Number(center.lat)
        };
      }
      state.mapViewCity = amapInstanceCity;
    } catch (error) {
      // Ignore an already detached map instance.
    }
  }

  function rememberAmapView() {
    if (
      !amapInstance ||
      state.route !== "map" ||
      !amapInstanceCity ||
      state.mapCity !== amapInstanceCity
    ) {
      return;
    }
    captureAmapView();
    const container = document.getElementById("amap-map");
    if (container) {
      container.dataset.mapZoom = String(state.mapZoom || "");
      container.dataset.mapCity = String(state.mapViewCity || "");
      container.dataset.mapCenter =
        state.mapCenter &&
        Number.isFinite(Number(state.mapCenter.longitude)) &&
        Number.isFinite(Number(state.mapCenter.latitude))
          ? state.mapCenter.longitude + "," + state.mapCenter.latitude
          : "";
    }
    replaceHistorySnapshot();
  }

  function destroyAmapView(capture) {
    if (!amapInstance) return;
    if (capture && state.mapViewCity === amapInstanceCity) {
      captureAmapView();
    }
    amapViewGeneration += 1;
    try {
      amapInstance.destroy();
    } catch (error) {
      // The map may already be detached by a WebView navigation.
    }
    amapInstance = null;
    amapInstanceCity = null;
    amapMarkers = [];
    amapLocationMarker = null;
    amapAddressMarker = null;
  }

  function addAmapLocationMarker(AMap) {
    if (
      !amapInstance ||
      !AMap ||
      !state.mapLocation ||
      !Number.isFinite(Number(state.mapLocation.longitude)) ||
      !Number.isFinite(Number(state.mapLocation.latitude))
    ) {
      return null;
    }
    if (amapLocationMarker) {
      try {
        amapInstance.remove(amapLocationMarker);
      } catch (error) {
        // A new map instance may already have replaced the old marker.
      }
    }
    amapLocationMarker = new AMap.Marker({
      position: [state.mapLocation.longitude, state.mapLocation.latitude],
      anchor: "center",
      content:
        '<span class="amap-location-marker" role="img" aria-label="我的当前位置"><i></i></span>',
      title: "我的当前位置",
      zIndex: 320
    });
    amapInstance.add(amapLocationMarker);
    return amapLocationMarker;
  }

  function addAmapAddressMarker(AMap) {
    if (
      !amapInstance ||
      !AMap ||
      !state.mapAddressLocation ||
      !Number.isFinite(Number(state.mapAddressLocation.longitude)) ||
      !Number.isFinite(Number(state.mapAddressLocation.latitude))
    ) {
      return null;
    }
    amapAddressMarker = new AMap.Marker({
      position: [
        state.mapAddressLocation.longitude,
        state.mapAddressLocation.latitude
      ],
      anchor: "center",
      content:
        '<span class="amap-address-marker"><i></i><b>地址</b></span>',
      title: state.mapAddressLabel || state.mapAddress,
      zIndex: 310
    });
    amapInstance.add(amapAddressMarker);
    return amapAddressMarker;
  }

  function initAmapMap() {
    const container = document.getElementById("amap-map");
    if (!container) return;
    const destination = LOGIC.getDestination(state.mapCity);
    if (!destination) return;
    if (amapInstance) {
      if (state.mapViewCity === amapInstanceCity) captureAmapView();
      destroyAmapView(false);
    }
    const mapGeneration = ++amapViewGeneration;
    const mapCity = destination.id;
    amapInstanceCity = mapCity;
    const band = MAP_BANDS.find((item) => item.id === state.mapBand) || MAP_BANDS[0];
    let hotels = LOGIC.hotelsFor(destination.id).filter(band.test);
    if (state.mapBrand !== "all") {
      hotels = hotels.filter((hotel) => hotel.brand === state.mapBrand);
    }
    if (state.mapQuery.trim()) {
      const query = state.mapQuery.trim().toLowerCase();
      hotels = hotels.filter(
        (hotel) =>
          String(hotel.name || "").toLowerCase().includes(query) ||
          String(hotel.nameEn || "").toLowerCase().includes(query) ||
          String(hotel.brand || "").toLowerCase().includes(query)
      );
    }
    hotels = applyMapAddressFilter(hotels);
    hotels = hotels
      .slice()
      .sort((a, b) => {
        if (state.mapAddressLocation) {
          return (
            Number(a.addressDistanceKm) - Number(b.addressDistanceKm) ||
            b.quality - a.quality
          );
        }
        return (
          (a.distanceFromCenterKm || 9999) - (b.distanceFromCenterKm || 9999) ||
          b.quality - a.quality
        );
      });
    const selectedHotel =
      hotels.find((hotel) => hotel.id === state.mapSelectedHotelId) || hotels[0] || null;
    container.innerHTML = '<div class="map-loading">正在加载高德地图…</div>';
    ensureAmap()
      .then((AMap) => {
        if (
          !document.getElementById("amap-map") ||
          mapGeneration !== amapViewGeneration ||
          state.mapCity !== mapCity
        ) {
          return;
        }
        const hasRestoredView =
          state.mapViewCity === mapCity &&
          state.mapCenter &&
          Number.isFinite(Number(state.mapCenter.longitude)) &&
          Number.isFinite(Number(state.mapCenter.latitude)) &&
          Number.isFinite(Number(state.mapZoom));
        const center =
          hasRestoredView &&
          Number.isFinite(Number(state.mapCenter.longitude)) &&
          Number.isFinite(Number(state.mapCenter.latitude))
            ? [state.mapCenter.longitude, state.mapCenter.latitude]
            : state.mapAddressLocation
              ? [
                  state.mapAddressLocation.longitude,
                  state.mapAddressLocation.latitude
                ]
            : destination.coords
              ? [destination.coords.longitude, destination.coords.latitude]
              : [116.397428, 39.90923];
        const restoredZoom = hasRestoredView ? Number(state.mapZoom) : null;
        container.dataset.restoredView = String(hasRestoredView);
        container.dataset.restoreZoom =
          restoredZoom == null ? "" : String(restoredZoom);
        amapInstance = new AMap.Map(container, {
          zoom: Number.isFinite(restoredZoom) ? restoredZoom : 11,
          center,
          resizeEnable: true,
          viewMode: "2D",
          mapStyle: "amap://styles/normal"
        });
        let viewReady = false;
        const rememberView = () => {
          if (
            !viewReady ||
            !amapInstance ||
            mapGeneration !== amapViewGeneration ||
            state.route !== "map" ||
            state.mapCity !== mapCity
          ) {
            return;
          }
          rememberAmapView();
        };
        amapInstance.on("zoomend", rememberView);
        amapInstance.on("moveend", rememberView);
        container.addEventListener("click", (event) => {
          const pin = event.target.closest && event.target.closest(".amap-price-marker");
          if (!pin) return;
          const hotelId = pin.getAttribute("data-hotel-id");
          if (!hotelId) return;
          const hotel = LOGIC.getHotel(hotelId);
          if (!hotel) return;
          rememberView();
          state.mapSelectedHotelId = hotelId;
          navigate("hotel", {
            selectedHotelId: hotel.id,
            navContext: "map"
          });
        });
        AMap.plugin(["AMap.Scale", "AMap.ToolBar"], () => {
          if (!amapInstance || mapGeneration !== amapViewGeneration) return;
          amapInstance.addControl(new AMap.Scale());
          amapInstance.addControl(new AMap.ToolBar({ position: { top: "12px", right: "12px" } }));
        });
        amapMarkers = hotels
          .filter(
            (hotel) =>
              hotel.coords &&
              Number.isFinite(Number(hotel.coords.latitude)) &&
              Number.isFinite(Number(hotel.coords.longitude))
          )
          .map((hotel) => {
            const isSelected = Boolean(selectedHotel && selectedHotel.id === hotel.id);
            const marker = new AMap.Marker({
              position: [hotel.coords.longitude, hotel.coords.latitude],
              anchor: "bottom-center",
              title: hotel.name,
              content:
                '<span class="amap-price-marker' +
                (isSelected ? " is-featured" : "") +
                '" data-hotel-id="' +
                esc(hotel.id) +
                '">' +
                esc(priceLabel(hotel)) +
                "</span>",
              extData: { hotelId: hotel.id },
              zIndex: isSelected ? 200 : 100
            });
            return marker;
          });
        if (amapMarkers.length) {
          amapInstance.add(amapMarkers);
        }
        addAmapLocationMarker(AMap);
        addAmapAddressMarker(AMap);
        window.setTimeout(() => {
          if (
            !amapInstance ||
            mapGeneration !== amapViewGeneration ||
            state.mapCity !== mapCity
          ) {
            return;
          }
          if (Number.isFinite(restoredZoom)) {
            amapInstance.setZoomAndCenter(restoredZoom, center);
          } else if (amapMarkers.length || amapAddressMarker) {
            const fitMarkers = amapAddressMarker
              ? amapMarkers.concat([amapAddressMarker])
              : amapMarkers;
            amapInstance.setFitView(fitMarkers, false, [36, 36, 36, 36], 14);
          } else if (state.mapAddressLocation) {
            amapInstance.setZoomAndCenter(13, center);
          }
          viewReady = true;
          window.setTimeout(rememberView, 180);
        }, 120);
      })
      .catch((error) => {
        const mapContainer = document.getElementById("amap-map");
        if (mapContainer) {
          mapContainer.innerHTML =
            '<div class="map-load-error">' +
            esc(error.message || "高德地图加载失败") +
            "<br />酒店列表仍可正常使用。</div>";
        }
      });
  }

  const locationPendingRequests = new Map();
  let locationRequestSequence = 0;

  function requestCurrentLocation() {
    if (
      window.AndroidLocation &&
      typeof window.AndroidLocation.getCurrentLocation === "function"
    ) {
      return new Promise((resolve, reject) => {
        const requestId = "location-" + ++locationRequestSequence;
        const timer = window.setTimeout(() => {
          locationPendingRequests.delete(requestId);
          reject(new Error("定位超时，请稍后重试"));
        }, 20000);
        locationPendingRequests.set(requestId, { resolve, reject, timer });
        try {
          window.AndroidLocation.getCurrentLocation(requestId);
        } catch (error) {
          window.clearTimeout(timer);
          locationPendingRequests.delete(requestId);
          reject(error);
        }
      });
    }
    if (!navigator.geolocation) {
      return Promise.reject(new Error("当前设备不支持定位"));
    }
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: Number(position.coords.latitude),
            longitude: Number(position.coords.longitude)
          });
        },
        (error) =>
          reject(
            new Error(
              error && error.message ? error.message : "无法获取当前位置"
            )
          ),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });
  }

  window.onNativeLocationResult = function (
    requestId,
    latitude,
    longitude,
    errorMessage
  ) {
    const pending = locationPendingRequests.get(requestId);
    if (!pending) return;
    window.clearTimeout(pending.timer);
    locationPendingRequests.delete(requestId);
    if (errorMessage) {
      pending.reject(new Error(errorMessage));
      return;
    }
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      pending.reject(new Error("定位结果无效"));
      return;
    }
    pending.resolve({ latitude: lat, longitude: lng });
  };

  function setMapLocationLoading(loading) {
    state.mapLocationLoading = Boolean(loading);
    const button = document.querySelector("[data-action='locate-map']");
    if (!button) return;
    button.classList.toggle("is-loading", Boolean(loading));
    button.disabled = Boolean(loading);
    button.setAttribute("aria-busy", String(Boolean(loading)));
  }

  async function locateCurrentMapPosition() {
    if (state.mapLocationLoading) return;
    if (!amapInstance) {
      showToast("地图仍在加载，请稍后再定位");
      return;
    }
    setMapLocationLoading(true);
    try {
      const location = await requestCurrentLocation();
      const AMap = await ensureAmap();
      if (!amapInstance) throw new Error("地图已关闭，请重新打开地图");
      state.mapLocation = {
        latitude: location.latitude,
        longitude: location.longitude,
        updatedAt: new Date().toISOString()
      };
      addAmapLocationMarker(AMap);
      const currentZoom = Number(amapInstance.getZoom());
      amapInstance.setZoomAndCenter(
        Number.isFinite(currentZoom) ? Math.max(14, currentZoom) : 14,
        [location.longitude, location.latitude]
      );
      window.setTimeout(rememberAmapView, 240);
      showToast("已定位到当前位置");
    } catch (error) {
      showToast(error.message || "定位失败，请检查系统权限");
    } finally {
      setMapLocationLoading(false);
    }
  }

  function emptyState(title, description, buttonLabel, action) {
    return (
      '<div class="empty-state"><div class="empty-mark">' +
      icon("building") +
      "</div><strong>" +
      esc(title) +
      "</strong><p>" +
      esc(description) +
      "</p>" +
      (buttonLabel
        ? '<button class="btn btn-secondary" data-action="' +
          esc(action) +
          '">' +
          esc(buttonLabel) +
          "</button>"
        : "") +
      "</div>"
    );
  }

  function stripDetailParentheses(value) {
    let text = cleanHotelText(value);
    for (let index = 0; index < 4; index += 1) {
      const next = text.replace(/[（(][^（）()]*[）)]/g, "");
      if (next === text) break;
      text = next;
    }
    return text
      .replace(/;;+/g, "；")
      .replace(/\s+/g, " ")
      .trim();
  }

  function summarizeHotelFacility(value) {
    const seen = new Set();
    return stripDetailParentheses(value)
      .split(/[;；]/)
      .map((item) => item.replace(/^[：:\s]+/, "").trim())
      .filter((item) => item.length >= 2)
      .filter((item) => {
        if (seen.has(item)) return false;
        seen.add(item);
        return true;
      })
      .slice(0, 6)
      .join("、")
      .slice(0, 150);
  }

  function summarizeHotelPolicy(value) {
    const text = stripDetailParentheses(value);
    if (text.length <= 110) return text;
    const firstParts = text
      .split(/[;；]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join("；");
    return (firstParts || text).slice(0, 120) + "…";
  }

  function renderHotelInsightSections(insight) {
    if (!insight) return "";
    const reviewEntries = (insight.reviews || [])
      .map((review) => ({
        source: review.source || "fliggy",
        text: review.content || review.text || ""
      }))
      .filter((review) => review.text);
    const reviewSummary = LOGIC.summarizeEvidence(reviewEntries, {
      label: "公开与主动导入评价"
    });
    const reviewScore = LOGIC.scoreEvidence(reviewEntries);
    const rooms = (insight.rooms || []).slice(0, 8);
    const facilityPriority = [
      "热门设施",
      "餐饮服务",
      "休闲游乐设施服务",
      "交通服务",
      "商务服务",
      "前台/礼宾服务"
    ];
    const facilityGroups = facilityPriority
      .map((name) => ({
        name,
        value: summarizeHotelFacility((insight.facilities || {})[name] || "")
      }))
      .filter((item) => item.value);
    const policyLabels = {
      checkInOut: "入住/退房",
      breakfast: "早餐",
      children: "儿童",
      pets: "宠物",
      deposit: "押金",
      extraBed: "加床",
      toiletries: "洗漱用品"
    };
    const policyRows = Object.entries(insight.policies || {})
      .filter(([, value]) => cleanHotelText(value))
      .map(([key, value]) => [
        policyLabels[key] || key,
        summarizeHotelPolicy(value)
      ])
      .filter(([, value]) => value)
      .slice(0, 4);
    return (
      '<section class="detail-section card">' +
      '<div class="section-head"><div><h2>住客口碑分</h2><p>根据公开评论本地计算，不是酒店官网评分</p></div><span class="mode-tag">' +
      (reviewScore ? reviewScore.sampleSize + " 条样本" : "样本待补") +
      "</span></div>" +
      '<p class="micro muted">采集时间 ' +
      esc(formatDate(insight.fetchedAt)) +
      " · 公开接口未返回评论日期</p>" +
      (reviewScore
        ? '<div class="review-score-block"><strong>' +
          reviewScore.score.toFixed(1) +
          '</strong><span>/ 10</span><div><em>本地口碑分</em><p>正面样本 ' +
          reviewScore.positiveCount +
          " · 负面样本 " +
          reviewScore.negativeCount +
          " · 飞猪/携程/小红书来源分别计数</p></div></div>"
        : '<div class="review-empty"><strong>暂时没有足够公开评论</strong><p>不会用模型编造评价。可稍后联网重试。</p></div>') +
      (reviewSummary
        ? '<blockquote class="public-review-summary">' +
          esc(reviewSummary.text) +
          '</blockquote><div class="review-meta">' +
          Object.keys(reviewSummary.sourceCounts)
            .map((sourceId) => {
              const source = DATA.reviewSources.find(
                (item) => item.id === sourceId
              );
              return (
                "<span>" +
                esc(source ? source.short : sourceId) +
                " · " +
                reviewSummary.sourceCounts[sourceId] +
                "</span>"
              );
            })
            .join("") +
          "</div>"
        : "") +
      (reviewEntries.length
        ? '<details class="insight-evidence"><summary>查看 ' +
          reviewEntries.length +
          ' 条评论原文</summary><div>' +
          reviewEntries
            .map((review, index) => {
              const source = DATA.reviewSources.find(
                (item) => item.id === review.source
              );
              return (
                '<article><strong>#' +
                (index + 1) +
                " " +
                esc(source ? source.label : "公开评价") +
                "</strong><p>" +
                esc(review.text) +
                "</p></article>"
              );
            })
            .join("") +
          "</div></details>"
        : "") +
      '<p class="micro muted">口径：基于接口抓取时可见的飞猪、携程公开评论做主题归纳与 10 分制本地打分，分数不代表万豪、携程或飞猪官方评分；评价日期缺失时不宣称属于近一年。小红书批量采集因平台风控暂未提供，后续将通过云服务子任务处理。</p>' +
      "</section>" +
      '<section class="detail-section card">' +
      '<div class="section-head"><div><h2>价格与房型</h2><p>接口抓取时的公开房型起价</p></div><span class="mode-tag">' +
      rooms.length +
      " 个房型" +
      "</span></div>" +
      (rooms.length
        ? '<div class="room-rate-list">' +
          rooms
            .map((room) => {
              const rate = room.rates && room.rates[0];
              return (
                '<article class="room-rate-card"><div><strong>' +
                esc(room.name) +
                "</strong><p>" +
                esc(room.bed || "床型待确认") +
                " · " +
                esc(room.sizeAndFloor || "面积/楼层待确认") +
                '</p><small>' +
                esc(rate ? rate.breakfast || "早餐政策待确认" : "该房型未见公开价格") +
                "</small></div><b>" +
                (rate ? money(rate.price) : "查价") +
                "</b></article>"
              );
            })
            .join("") +
          "</div>"
        : '<p class="micro muted">公开接口暂未返回可售房型价格。</p>') +
      '<p class="micro muted" style="margin-top:9px">房型价格是采集时公开页面参考，入住日期、税费、会员价与库存以下单页为准。</p>' +
      "</section>" +
      '<section class="detail-section card">' +
      '<div class="section-head"><div><h2>酒店特色、设施与政策</h2><p>已按重点精简，完整规则以下单页为准</p></div><span class="mode-tag">精简摘要</span></div>' +
      '<div class="inline-chips">' +
      (insight.basics && insight.basics.opening
        ? '<span class="inline-chip">开业 ' + esc(insight.basics.opening) + "</span>"
        : "") +
      (insight.basics && insight.basics.renovation
        ? '<span class="inline-chip">装修 ' +
          esc(insight.basics.renovation) +
          "</span>"
        : "") +
      (insight.basics && insight.basics.rooms
        ? '<span class="inline-chip">' + esc(insight.basics.rooms) + "</span>"
        : "") +
      (insight.basics && insight.basics.pool
        ? '<span class="inline-chip">泳池：' +
          esc(stripDetailParentheses(insight.basics.pool).slice(0, 30)) +
          "</span>"
        : "") +
      "</div>" +
      (insight.basics && insight.basics.business
        ? '<p class="hotel-feature-copy">' +
          esc(insight.basics.business.slice(0, 140)) +
          "</p>"
        : "") +
      (facilityGroups.length
        ? '<div class="facility-groups">' +
          facilityGroups
            .map(
              ({ name, value }) =>
                '<div><strong>' +
                esc(name) +
                "</strong><p>" +
                esc(value) +
                "</p></div>"
            )
            .join("") +
          "</div>"
        : "") +
      (policyRows.length
        ? '<div class="policy-grid">' +
          policyRows
            .map(
              ([label, value]) =>
                '<div><span>' +
                esc(label) +
                "</span><p>" +
                esc(value) +
                "</p></div>"
            )
            .join("") +
          "</div>"
        : "") +
      "</section>" +
      '<section class="detail-section card">' +
      "<h2>积分与会员礼遇</h2>" +
      "<p>现金价和积分房数量来自万豪官网公开查询，分别陈列。会员等级加成、行政酒廊和早餐权益仍以官方当期规则及具体房价代码为准。</p>" +
      '<div class="inline-chips"><span class="inline-chip">现金价见房型</span><span class="inline-chip">积分兑换需登录官方</span><span class="inline-chip">权益以酒店确认为准</span></div>' +
      '<a class="btn btn-secondary btn-block" style="margin-top:10px" href="https://www.marriott.com.cn/loyalty/" target="_self">查看万豪旅享家规则</a>' +
      "</section>"
    );
  }

  function renderHotel() {
    const hotel = LOGIC.getHotel(state.selectedHotelId);
    if (!hotel) {
      state.route = "home";
      return renderHome();
    }
    const destination = LOGIC.getDestination(hotel.destinationId);
    const cost = LOGIC.calculateTripCost(destination, hotel, state.params);
    const insight = hotelInsightCache[hotel.id] || null;
    const insightReviews = insight
      ? (insight.reviews || []).map((review) => ({
          source: review.source || "fliggy",
          text: review.content || review.text || ""
        }))
      : [];
    const publicScore = LOGIC.scoreEvidence(insightReviews);
    const valueInfo = pointsValuation(hotel);
    const pointsPromotion = pointsPromotionForHotel(hotel);
    const isFavorite = favorites.has(hotel.id);
    const isCompared = comparisons.has(hotel.id);
    const bookingUrl =
      hotel.bookingUrl ||
      (insight && insight.detailUrl) ||
      hotel.flyAiDetailUrl ||
      "";
    return (
      '<div class="screen">' +
      '<div class="back-row"><button class="back-button" data-action="go-back">' +
      icon("arrowLeft") +
      "返回</button>" +
      '<span class="micro muted">' +
      esc(destination.name) +
      " · " +
      esc(hotel.brandTier) +
      "</span></div>" +
      '<section class="hotel-detail-hero"' +
      (hasPropertyPhoto(hotel)
        ? ' style="background-image:linear-gradient(180deg,rgba(9,23,37,.12),rgba(9,23,37,.86)),url(&quot;' +
          esc(hotel.imageUrl) +
          '&quot;);background-size:cover;background-position:center"'
        : "") +
      ">" +
      '<span class="hero-brand">' +
      esc(hotel.brand) +
      " · " +
      esc(hotel.area) +
      "</span>" +
      "<h1>" +
      esc(hotel.name) +
      "</h1>" +
      '<p class="english-name">' +
      esc(hotel.nameEn) +
      "</p>" +
      '<div class="hotel-hero-meta"><span>官方评分 ' +
      (hotel.rating ? hotel.rating.toFixed(1) : "待补") +
      " / 5 · " +
      (hotel.reviewCount ? hotel.reviewCount + " 条" : "评价数待补") +
      "</span><span>质量 " +
      qualityLabel(hotel) +
      (publicScore ? " · 本地口碑 " + publicScore.score.toFixed(1) : "") +
      "</span></div>" +
      "</section>" +
      '<div class="hotel-summary-grid">' +
      '<div class="hotel-summary-cell"><span>公开报价</span><strong>' +
      esc(priceLabel(hotel)) +
      "</strong><em>" +
      (hasPrice(hotel)
        ? priceSourceLabel(hotel) +
          " · " +
          esc(formatDate(hotel.priceMeta && hotel.priceMeta.checkIn))
        : "需联网查价") +
      "</em></div>" +
      '<div class="hotel-summary-cell"><span>官网积分价</span><strong>' +
      esc(pointsLabel(hotel)) +
      "</strong><em>" +
      (Number(hotel.pointsPrice) > 0
        ? "积分房 / 晚 · " +
          esc(formatDate(hotel.pointsMeta && hotel.pointsMeta.checkIn))
        : "点击官网更新获取") +
      "</em></div>" +
      '<div class="hotel-summary-cell"><span>住宿预算</span><strong>' +
      money(cost.lodging) +
      "</strong><em>" +
      cost.nights +
      " 晚 · " +
      cost.rooms +
      " 间 · " +
      (cost.priceKnown ? "按公开房价" : "按品牌档次估算") +
      "</em></div>" +
      "</div>" +
      '<div class="btn-row">' +
      '<button class="btn btn-secondary" data-action="toggle-favorite" data-id="' +
      esc(hotel.id) +
      '">' +
      icon(isFavorite ? "heartFill" : "heart") +
      (isFavorite ? "已收藏" : "收藏酒店") +
      "</button>" +
      '<button class="btn btn-primary" data-action="toggle-compare" data-id="' +
      esc(hotel.id) +
      '">' +
      icon("compare") +
      (isCompared ? "移出对比" : "加入对比") +
      "</button>" +
      "</div>" +
      bookingButton(
        bookingUrl,
        "飞猪订房 / 查看实时房型",
        "btn btn-gold btn-block",
        "margin-top:9px"
      ) +
      '<section class="detail-section card">' +
      "<h2>酒店介绍</h2><p>" +
      esc(hotel.intro) +
      "</p>" +
      (pointsValueLabel(hotel)
        ? '<div class="points-value-note">' +
          icon("wallet") +
          "<span><strong>积分价值换算：</strong>" +
          esc(pointsValueLabel(hotel)) +
          "。该结果仅为估算，不代表官方兑换价值。</span></div>"
        : "") +
      '<div class="mini-info-card" style="margin-top:12px"><strong>适合</strong><ul>' +
      hotel.suitable
        .map((item) => "<li>" + esc(item) + "</li>")
        .join("") +
      "</ul></div>" +
      "</section>" +
      (state.hotelInsightLoadingId === hotel.id
        ? '<section class="detail-section card"><div class="planner-status loading">正在联网获取房型、设施与公开评论，并保存到本机…</div></section>'
        : "") +
      (state.hotelInsightError
        ? '<section class="detail-section card"><div class="planner-status error">' +
          esc(state.hotelInsightError) +
          '<button class="btn btn-secondary btn-block" style="margin-top:9px" data-action="load-hotel-insight" data-id="' +
          esc(hotel.id) +
          '">重新尝试</button></div></section>'
        : "") +
      (insight
        ? renderHotelInsightSections(insight) +
          '<div class="btn-row" style="padding:0 1px"><button class="btn btn-secondary" data-action="load-hotel-insight" data-id="' +
          esc(hotel.id) +
          '" data-force="true">更新设施与评论</button>' +
          bookingButton(
            insight.detailUrl,
            "查看飞猪房型",
            "btn btn-gold"
          ) +
          "</div>"
        : state.hotelInsightLoadingId !== hotel.id
          ? '<section class="detail-section card"><div class="section-head"><div><h2>设施与公开住客评价</h2><p>从酒店公开详情采集，保存本机</p></div><span class="mode-tag">待联网</span></div><p>点击后获取房型、设施、政策与约 5—10 条公开评论，生成本地口碑摘要和评分。</p><button class="btn btn-primary btn-block" data-action="load-hotel-insight" data-id="' +
            esc(hotel.id) +
            '">获取设施与住客评价</button></section>'
          : "") +
      '<section class="detail-section card">' +
      "<h2>价格与权益</h2>" +
      '<div class="budget-row" style="margin-top:0;padding-top:0;border-top:0">' +
      '<div class="budget-main"><strong>' +
      esc(priceLabel(hotel)) +
      "</strong><span>" +
      (hasPrice(hotel)
        ? priceSourceLabel(hotel) +
          " · 入住日期 " +
          esc(formatDate(hotel.priceMeta && hotel.priceMeta.checkIn)) +
          " · 房型、税费与库存以下单页为准"
        : "尚未取得公开报价 · 可从地图页刷新当前城市房价") +
      "</span></div>" +
      modeTag(hotel.mode) +
      "</div>" +
      (pointsPromotion
        ? '<div class="points-promotion-detail"><div><span>积分闪促</span><strong>额外赠 ' +
          Math.round(pointsPromotion.bonusPoints).toLocaleString("zh-CN") +
          ' 分</strong></div><p>' +
          esc(pointsPromotion.title) +
          (pointsPromotion.validFrom || pointsPromotion.validTo
            ? " · 有效期 " +
              esc(formatDate(pointsPromotion.validFrom)) +
              " 至 " +
              esc(formatDate(pointsPromotion.validTo))
            : "") +
          "。来源：" +
          esc(pointsPromotion.source) +
          "。实际到账与会员资格以活动页和万豪官方确认为准。</p></div>"
        : "") +
      (valueInfo
        ? '<div class="redemption-verdict ' +
          (valueInfo.difference >= 0 ? "is-points" : "is-cash") +
          '"><div class="redemption-metrics"><div><span>积分约当价值</span><strong>' +
          money(valueInfo.estimated) +
          "</strong></div><div><span>现金价与积分价值差</span><strong>" +
          (valueInfo.difference >= 0 ? "积分省 " : "现金省 ") +
          money(Math.abs(valueInfo.difference)) +
          "</strong></div></div><p><strong>判断：</strong>" +
          (valueInfo.difference >= 0
            ? "按你当前的每万分估值，使用积分更划算，但仍需确认可兑换房型和早餐权益。"
            : "按你当前的每万分估值，现金价更便宜，不建议为了这张积分房放弃现金价。") +
          " 估算仅用于比较，不代表官方兑换价值。</p></div>"
        : '<div class="redemption-verdict is-pending"><p>同时取得现金价和官网积分价后，这里会自动判断积分与现金哪个更划算。</p></div>') +
      '<div class="btn-row" style="margin-top:10px">' +
      '<button class="btn btn-gold" data-action="refresh-flyai-hotel-city" data-id="' +
      esc(hotel.destinationId) +
      '">' +
      icon("spark") +
      "飞猪实时查价</button>" +
      '<button class="btn btn-secondary" data-action="refresh-hotel-city" data-id="' +
      esc(hotel.destinationId) +
      '">' +
      icon("source") +
      "官网更新</button></div>" +
      (!hasPrice(hotel)
        ? '<button class="btn btn-primary btn-block" style="margin-top:8px" data-action="lookup-hotel-price" data-id="' +
          esc(hotel.id) +
          '">' +
          icon("search") +
          "只查询这家酒店价格</button>"
        : "") +
      (state.flyAi.message
        ? '<p class="micro muted" style="margin:9px 0 0">' +
          esc(state.flyAi.message) +
          "</p>"
        : "") +
      '<div class="inline-chips" style="margin-top:11px"><span class="inline-chip">现金 ' +
      esc(priceLabel(hotel)) +
      "</span><span class=\"inline-chip\">积分 " +
      esc(pointsLabel(hotel)) +
      '</span><span class="inline-chip">早餐待核实</span><span class="inline-chip">取消政策待核实</span><span class="inline-chip">会员权益以官方为准</span></div>' +
      '<p style="margin-top:12px">积分价、会员价和早餐酒廊权益必须通过官方渠道确认。旅伴不会用住客经验替代酒店承诺。</p>' +
      bookingButton(bookingUrl, "飞猪订房", "btn btn-gold btn-block") +
      '<a class="btn btn-secondary btn-block" href="' +
      esc(hotel.sourceUrl) +
      '" target="_self">' +
      icon("external") +
      "去万豪官方查询</a>" +
      "</section>" +
      '<div class="method-note">' +
      icon("info") +
      "<span>住宿预算按 " +
      cost.nights +
      " 晚 × " +
      cost.rooms +
      " 间计算，不含交通、餐饮和门票。没有公开报价时按品牌档次估算并明确标记；预订前请再次核验价格、房型和权益。</span>" +
      "</div>" +
      "</div>"
    );
  }

  function renderRankings() {
    const ranking = LOGIC.getRankedHotels({
      mode: state.rankMode,
      band: state.rankBand,
      management: state.rankManagement
    });
    const isQuality = state.rankMode === "quality";
    return (
      '<div class="screen">' +
      '<section class="rank-header">' +
      '<span class="eyebrow" style="position:relative;z-index:1">Quality ledger</span>' +
      "<h1>住得值不值</h1>" +
      "<p>质量和性价比分开看。价位与场景不同，不硬塞进一张总榜。</p>" +
      "</section>" +
      '<div class="segmented">' +
      '<button class="' +
      (isQuality ? "is-active" : "") +
      '" data-action="set-rank-mode" data-id="quality">质量 Top 10</button>' +
      '<button class="' +
      (!isQuality ? "is-active" : "") +
      '" data-action="set-rank-mode" data-id="value">性价比 Top 10</button>' +
      "</div>" +
      '<div class="filter-row" style="margin-top:12px">' +
      DATA.priceBands
        .map((band) => {
          return (
            '<button class="filter-chip ' +
            (state.rankBand === band.id ? "is-active" : "") +
            '" data-action="set-rank-band" data-id="' +
            band.id +
            '">' +
            esc(band.label) +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      '<section class="section">' +
      '<div class="section-head"><div><h2>' +
      (isQuality ? "质量榜" : "性价比榜") +
      "</h2><p>" +
      ranking.length +
      " 家符合当前条件 · " +
      esc((DATA.priceBands.find((band) => band.id === state.rankBand) || {}).label || "全部价位") +
      "</p></div><span class=\"micro muted\">Top " +
      ranking.length +
      "</span></div>" +
      (ranking.length
        ? '<div class="ranking-list">' +
          ranking
            .map((item) => {
              const percent = Math.max(
                4,
                Math.min(100, (Number(item.displayScore) / 10) * 100)
              );
              return (
                '<article class="ranking-row"><span class="rank-number">' +
                item.rank +
                '</span><div class="ranking-copy"><strong>' +
                esc(item.hotel.name) +
                "</strong><p>" +
                esc(item.destination.name) +
                "</p>" +
                '<div class="score-line"><div class="score-track"><div class="score-fill" style="width:' +
                percent.toFixed(1) +
                '%"></div></div><span class="score-value">' +
                (isQuality ? item.displayScore.toFixed(1) : item.displayScore.toFixed(1)) +
                "</span></div></div>" +
                '<div class="ranking-price"><strong>' +
                money(item.hotel.price) +
                "</strong><span>/ 晚起</span><br />" +
                '<button class="section-link" style="margin-top:7px" data-action="view-hotel" data-id="' +
                esc(item.hotel.id) +
                '">详情</button></div></article>'
              );
            })
            .join("") +
          "</div>"
        : emptyState(
            "这个价位暂时没有候选",
            "不补位、不拿低质量结果凑满 Top 10。换一个价位或子品牌查看。",
            "查看全部价位",
            "reset-rank-filters"
          )) +
      '<details class="rules-card"><summary>榜单怎么算</summary><p>' +
      (isQuality
        ? "质量指数由近期住客评分、服务、房间状态、卫生、位置、设施和稳定性组成；社交主帖与评论用于补充问题和场景信号，不与结构化评分简单相加。"
        : "性价比指数使用同城同价位质量分位与含税成本比较。MVP 中按质量指数与参考房价计算价值指数；接入实时数据和权益后，应加入早餐、酒廊、积分与取消政策。") +
      " 当前数据为结构样例，不用于真实预订决策。</p></details>" +
      "</section></div>"
    );
  }

  function rankBrandOptions() {
    const counts = {};
    DATA.hotels.forEach((hotel) => {
      if (!hotel.brand) return;
      counts[hotel.brand] = (counts[hotel.brand] || 0) + 1;
    });
    return Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b, "zh-CN"))
      .map(
        (brand) =>
          '<option value="' +
          esc(brand) +
          '"' +
          (state.rankBrand === brand ? " selected" : "") +
          ">" +
          esc(brand) +
          " · " +
          counts[brand] +
          " 家</option>"
      )
      .join("");
  }

  function rankBrandChips() {
    const counts = {};
    DATA.hotels.forEach((hotel) => {
      if (!hotel.brand) return;
      counts[hotel.brand] = (counts[hotel.brand] || 0) + 1;
    });
    return Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b, "zh-CN"))
      .map(
        (brand) =>
          '<button class="filter-chip ' +
          (state.rankBrand === brand ? "is-active" : "") +
          '" data-action="set-rank-brand" data-id="' +
          esc(brand) +
          '">' +
          esc(brand) +
          "</button>"
      )
      .join("");
  }

  function valueRankingOptions(overrides) {
    return Object.assign(
      {
        scope: state.rankScope,
        band: state.rankBand,
        brand: state.rankBrand,
        season: state.rankSeason,
        month: new Date().getMonth() + 1,
        sort: state.rankSort,
        limit: state.rankLimit,
        prefs: valuePrefs,
        bonusPointsFor: (hotel) => {
          const promotion = pointsPromotionForHotel(hotel);
          return promotion ? promotion.bonusPoints : 0;
        }
      },
      overrides || {}
    );
  }

  function rankScopeOptions() {
    const cityCounts = {};
    DATA.hotels.forEach((hotel) => {
      if (hotel.city) cityCounts[hotel.city] = (cityCounts[hotel.city] || 0) + 1;
    });
    const regionCounts = DATA.catalogMeta.regionCounts || {};
    const regions = DATA.regions
      .filter((region) => region !== "全国")
      .map((region) => ({
        value: "region:" + region,
        label: region + " · " + (regionCounts[region] || 0) + " 家"
      }));
    const cities = Object.keys(cityCounts)
      .filter((city) => cityCounts[city] >= 2)
      .sort((a, b) => cityCounts[b] - cityCounts[a] || a.localeCompare(b, "zh-CN"))
      .map((city) => ({ value: "city:" + city, label: city + " · " + cityCounts[city] + " 家" }));
    const option = (item) =>
      '<option value="' +
      esc(item.value) +
      '"' +
      (state.rankScope === item.value ? " selected" : "") +
      ">" +
      esc(item.label) +
      "</option>";
    return (
      option({ value: "all", label: "全国 · " + DATA.hotels.length + " 家" }) +
      '<optgroup label="地区">' + regions.map(option).join("") + "</optgroup>" +
      '<optgroup label="城市">' + cities.map(option).join("") + "</optgroup>"
    );
  }

  function rankScopeLabel() {
    if (state.rankScope === "all") return "全国";
    return state.rankScope.replace(/^(region|city):/, "");
  }

  function rankBrandSelectOptions() {
    return (
      '<option value="all"' +
      (state.rankBrand === "all" ? " selected" : "") +
      ">全部品牌</option>" +
      rankBrandOptions()
    );
  }

  function valueSegment(action, current, items) {
    return items
      .map(
        (item) =>
          '<button type="button" class="' +
          (current === item.id ? "is-active" : "") +
          '" data-action="' +
          action +
          '" data-id="' +
          esc(item.id) +
          '" aria-pressed="' +
          (current === item.id ? "true" : "false") +
          '">' +
          esc(item.label) +
          "</button>"
      )
      .join("");
  }

  function happinessChips(item) {
    return item.happiness.parts
      .map((part) => {
        const tone = !part.known ? "is-unknown" : part.score >= 0.75 ? "is-strong" : part.score <= 0.15 ? "is-weak" : "";
        return (
          '<span class="value-chip ' +
          tone +
          '" title="' +
          esc(part.label + "：" + part.detail + "，" + part.points + " / " + part.weight + " 分") +
          '">' +
          esc(part.detail) +
          "</span>"
        );
      })
      .join("");
  }

  function valueLedger(item) {
    const cost = item.cost;
    const line = (label, value, note, tone) =>
      '<div class="ledger-line ' +
      (tone || "") +
      '"><span>' +
      esc(label) +
      (note ? "<em>" + esc(note) + "</em>" : "") +
      "</span><strong>" +
      value +
      "</strong></div>";
    const minus = (value) => "−" + esc(money(value));
    return (
      '<div class="value-ledger"><div class="ledger-col"><h4>一晚真实成本</h4>' +
      line(
        "房价",
        esc(money(cost.cost)),
        (cost.taxIncluded ? "含税" : "公开价，按含税处理") +
          (cost.currency && cost.currency !== "CNY" ? " · 原价 " + cost.currency + "，按 " + cost.fxRate + " 折人民币" : "")
      ) +
      (cost.discount > 0
        ? line("折扣", minus(cost.discount), cost.discountPct + "%", "is-credit")
        : "") +
      line(
        "入住积分回血",
        minus(cost.earnedValue),
        cost.earnedPoints.toLocaleString("zh-CN") + " 分 · " + cost.tierLabel + " · " + cost.basePerUsd + " 分/美元",
        "is-credit"
      ) +
      (cost.bonusPoints > 0
        ? line("闪促赠分", minus(cost.bonusValue), cost.bonusPoints.toLocaleString("zh-CN") + " 分", "is-credit")
        : line("闪促赠分", "¥0", "未取得活动数据")) +
      line("净成本", esc(money(cost.netCost)), "", "is-total") +
      awardLedger(item.award, line) +
      '</div><div class="ledger-col"><h4>幸福度 ' +
      item.happinessScore.toFixed(1) +
      "</h4>" +
      item.happiness.parts
        .map((part) =>
          line(part.label, part.points.toFixed(1) + '<small> / ' + part.weight + "</small>", part.detail, part.known ? "" : "is-muted")
        )
        .join("") +
      (item.seasonBonus > 0
        ? line("季节加成", "+" + item.seasonBonus.toFixed(1), item.season.reason, "is-credit")
        : "") +
      "</div></div>"
    );
  }

  function rankingExample(item) {
    if (!item) return "";
    const cost = item.cost;
    const parts = [money(cost.cost)];
    if (cost.discount > 0) parts.push("− " + money(cost.discount) + " 折扣");
    parts.push(
      "− " + money(cost.earnedValue) + "（" + cost.earnedPoints.toLocaleString("zh-CN") + " 分回血）"
    );
    if (cost.bonusValue > 0) parts.push("− " + money(cost.bonusValue) + " 闪促");
    return (
      '<p class="rules-example">以第 1 名' +
      esc(item.hotel.name) +
      "为例：净成本 " +
      esc(parts.join(" ")) +
      " = " +
      esc(money(cost.netCost)) +
      "；幸福度 " +
      item.happinessScore.toFixed(1) +
      " ÷ " +
      esc(money(cost.netCost)) +
      " × 1,000 = 每千元 " +
      item.valuePerThousand.toFixed(0) +
      " 幸福分。</p>"
    );
  }

  function awardFigure(award) {
    if (!award) {
      return '<div class="value-award is-missing"><span>积分房</span><strong>—</strong><em>未取得兑换价</em></div>';
    }
    const good = award.versusPrefs && award.versusPrefs >= 1;
    return (
      '<div class="value-award' +
      (good ? " is-good" : "") +
      (award.available ? "" : " is-soldout") +
      '"><span>积分房 / 晚</span><strong>' +
      esc(Math.round(award.points / 1000)) +
      "k</strong><em>" +
      (award.valuePer10k
        ? "每万分 " + esc(money(award.valuePer10k))
        : award.suspect ? "价值待核实" : "无同日现金价") +
      "</em></div>"
    );
  }

  function awardLedger(award, line) {
    if (!award) {
      return (
        '<h4 class="ledger-sub">积分兑换</h4>' +
        line("标准积分房", "—", "官方搜索未返回该酒店的兑换价", "is-muted")
      );
    }
    const verdict = !award.valuePer10k
      ? ""
      : award.versusPrefs >= 1
        ? "高于你的估值 ¥" + valuePrefs.pointValue + "，用积分更划算"
        : "低于你的估值 ¥" + valuePrefs.pointValue + "，付现金更划算";
    return (
      '<h4 class="ledger-sub">积分兑换</h4>' +
      line(
        "一晚所需积分",
        esc(award.points.toLocaleString("zh-CN")) + " 分",
        (award.checkIn ? formatDate(award.checkIn) + " 入住" : "") +
          (award.available ? "" : " · 当日无积分房"),
        award.available ? "" : "is-muted"
      ) +
      (award.cash
        ? line(
            "同日现金价",
            esc(money(award.cash)),
            "含税，与积分价同一晚" +
              (award.currency !== "CNY"
                ? " · 原价 " + award.currency + " " + Math.round(award.cashLocal).toLocaleString("zh-CN") + "，估算汇率"
                : "")
          )
        : "") +
      (award.valuePer10k
        ? line(
            "兑换价值",
            "每万分 " + esc(money(award.valuePer10k)),
            "现金价 ÷ 积分 × 10,000 · " + verdict,
            award.versusPrefs >= 1 ? "is-credit is-total" : "is-total"
          )
        : award.suspect
          ? line("兑换价值", "待核实", "同日现金价远高于常规房价，可能只剩高等级房型", "is-muted")
          : "")
    );
  }

  function valueRow(item) {
    const hotel = item.hotel;
    const expanded = state.rankExpandedId === hotel.id;
    return (
      '<article class="value-row' +
      (expanded ? " is-expanded" : "") +
      '"><span class="value-rank">' +
      item.rank +
      '</span><div class="value-main"><button type="button" class="value-name" data-action="view-hotel" data-id="' +
      esc(hotel.id) +
      '">' +
      esc(hotel.name) +
      '</button><p class="value-meta">' +
      esc(hotel.brand) +
      " · " +
      esc(hotel.city || (item.destination && item.destination.name) || "") +
      (item.season.reason ? ' · <span class="value-season">' + esc(item.season.reason) + "</span>" : "") +
      '</p><div class="value-chips">' +
      happinessChips(item) +
      '</div></div><div class="value-figures"><div><span>净成本</span><strong>' +
      esc(money(item.cost.netCost)) +
      '</strong><em>房价 ' +
      esc(money(item.cost.cost)) +
      '</em></div><div><span>幸福度</span><strong>' +
      item.happinessScore.toFixed(1) +
      '</strong><em title="每花 ¥1,000 净成本买到的幸福分">每千元幸福分 ' +
      item.valuePerThousand.toFixed(0) +
      "</em></div>" +
      awardFigure(item.award) +
      '</div><button type="button" class="value-toggle" data-action="toggle-rank-ledger" data-id="' +
      esc(hotel.id) +
      '" aria-expanded="' +
      (expanded ? "true" : "false") +
      '" aria-label="' +
      (expanded ? "收起成本明细" : "展开成本明细") +
      '" title="成本与幸福度明细">' +
      icon("calculator") +
      "</button>" +
      (expanded ? valueLedger(item) : "") +
      "</article>"
    );
  }

  function renderRankingsV2() {
    const options = valueRankingOptions();
    const result = LOGIC.getHappinessRanking(options);
    const champions =
      state.rankBand === "all" ? LOGIC.bandChampions(valueRankingOptions({ limit: 1 })) : [];
    const seasonItems = [{ id: "all", label: "全年" }].concat(
      LOGIC.SEASONS.map((season) => ({ id: season.id, label: season.label }))
    );
    const sortItems = [
      { id: "value", label: "性价比" },
      { id: "happiness", label: "幸福度" },
      { id: "cost", label: "净成本" },
      { id: "points", label: "积分价值" }
    ];
    const tierItems = LOGIC.ELITE_TIERS.map((tier) => ({ id: tier.id, label: tier.label }));
    const currentSeason = LOGIC.seasonForMonth(new Date().getMonth() + 1);
    const bandLabel = (DATA.priceBands.find((band) => band.id === state.rankBand) || {}).label || "全部价位";
    const title =
      rankScopeLabel() +
      (state.rankBrand === "all" ? "" : " · " + state.rankBrand) +
      (state.rankSeason === "all"
        ? ""
        : " · " + (LOGIC.SEASONS.find((season) => season.id === state.rankSeason) || {}).label + "季推荐");
    return (
      '<div class="screen value-screen">' +
      '<header class="value-header"><div><span class="eyebrow">Happiness per yuan</span><h1>幸福度性价比榜</h1></div>' +
      '<button type="button" class="icon-button" data-action="toggle-value-settings" aria-expanded="' +
      (state.rankSettingsOpen ? "true" : "false") +
      '" aria-label="积分与折扣口径" title="积分与折扣口径">' +
      icon("settings") +
      "</button></header>" +
      (state.rankSettingsOpen
        ? '<section class="value-settings" aria-label="积分与折扣口径">' +
          '<label class="value-field"><span>每万分价值</span><div class="value-input"><b>¥</b><input id="value-point-value" type="number" inputmode="numeric" min="0" max="2000" step="10" value="' +
          esc(valuePrefs.pointValue) +
          '" /></div></label>' +
          '<label class="value-field"><span>额外折扣</span><div class="value-input"><input id="value-discount" type="number" inputmode="numeric" min="0" max="60" step="1" value="' +
          esc(valuePrefs.discountPct) +
          '" /><b>%</b></div></label>' +
          '<div class="value-field value-field-wide"><span>会员等级</span><div class="segmented value-tiers">' +
          valueSegment("set-value-tier", valuePrefs.tier, tierItems) +
          "</div></div></section>"
        : "") +
      '<section class="value-controls" aria-label="榜单筛选">' +
      '<label class="value-select"><span>范围</span><select id="rank-scope">' +
      rankScopeOptions() +
      "</select></label>" +
      '<label class="value-select"><span>品牌</span><select id="rank-brand">' +
      rankBrandSelectOptions() +
      "</select></label>" +
      '<div class="value-select value-select-wide"><span>季节</span><div class="segmented value-segmented">' +
      valueSegment("set-rank-season", state.rankSeason, seasonItems) +
      "</div></div>" +
      '<div class="value-select value-select-wide"><span>净成本价位</span><div class="filter-row value-bands">' +
      DATA.priceBands
        .map(
          (band) =>
            '<button type="button" class="filter-chip ' +
            (state.rankBand === band.id ? "is-active" : "") +
            '" data-action="set-rank-band" data-id="' +
            band.id +
            '">' +
            esc(band.label) +
            "</button>"
        )
        .join("") +
      "</div></div></section>" +
      (champions.length
        ? '<section class="value-champions" aria-label="各价位冠军"><h2>各价位冠军</h2><div class="champion-grid">' +
          champions
            .map((entry) =>
              entry.item
                ? '<button type="button" class="champion" data-action="set-rank-band" data-id="' +
                  entry.band.id +
                  '"><span>' +
                  esc(entry.band.label) +
                  "</span><strong>" +
                  esc(entry.item.hotel.name) +
                  "</strong><em>净 " +
                  esc(money(entry.item.cost.netCost)) +
                  " · 幸福 " +
                  entry.item.happinessScore.toFixed(0) +
                  "</em></button>"
                : '<div class="champion is-empty"><span>' +
                  esc(entry.band.label) +
                  "</span><strong>暂无候选</strong><em>该范围无报价酒店</em></div>"
            )
            .join("") +
          "</div></section>"
        : "") +
      '<section class="section value-results"><div class="value-results-head"><div><h2>' +
      esc(title) +
      "</h2><p>" +
      result.candidates +
      " 家可比 · " +
      esc(bandLabel) +
      (result.unpriced ? " · " + result.unpriced + " 家无报价未参评" : "") +
      '</p></div><div class="segmented value-sort" role="group" aria-label="排序">' +
      valueSegment("set-rank-sort", state.rankSort, sortItems) +
      "</div></div>" +
      (result.items.length
        ? '<div class="value-list">' +
          result.items.map(valueRow).join("") +
          "</div>" +
          (result.candidates > result.items.length
            ? '<button type="button" class="btn btn-secondary btn-block value-more" data-action="more-rank-results">再看 ' +
              Math.min(20, result.candidates - result.items.length) +
              " 家</button>"
            : "")
        : emptyState(
            "当前条件没有候选",
            state.rankSeason !== "all"
              ? "这个范围里没有匹配该季节的酒店。可换成全年或扩大到地区、全国。"
              : "这个范围里没有取得公开报价的酒店，换个价位或范围试试。",
            "重置筛选",
            "reset-rank-filters"
          )) +
      '<details class="rules-card"><summary>榜单怎么算</summary>' +
      rankingExample(result.items[0]) +
      "<p><b>净成本</b> = 含税房价 − 额外折扣 − 入住积分回血 − 闪促赠分。入住积分按万豪会员条款：多数品牌每美元 10 分，源宿等长住品牌 5 分，再叠加会员等级奖励（银卡 +10%、金卡 +25%、白金 +50%、钛金 +75%）；房价按税前、汇率 7.1 折成美元。积分换成钱按你设置的每万分 ¥" +
      esc(valuePrefs.pointValue) +
      "。</p><p><b>积分房</b>是官方标准积分兑换（一晚所需积分），与同一晚的含税现金价一起抓取。<b>每万分价值</b> = 现金价 ÷ 积分 × 10,000，高于你的估值时标绿，表示这家用积分比付现金划算。港澳台报价按估算汇率（港币 0.91、澳门元 0.88、新台币 0.22）折成人民币；同日现金价超过常规房价 3 倍的视为只剩高价房型，不计价值。</p><p>幸福度满分 100：酒店评分 " +
      LOGIC.HAPPINESS_WEIGHTS.rating +
      "、风景 " +
      LOGIC.HAPPINESS_WEIGHTS.view +
      "、早餐丰盛度 " +
      LOGIC.HAPPINESS_WEIGHTS.breakfast +
      "、健身房 " +
      LOGIC.HAPPINESS_WEIGHTS.gym +
      "。风景取房型名中最好的景观，早餐看是否自助与菜系数量，资料缺失时按中性分处理并灰色标出。选择季节后，符合当季玩法的酒店另加最多 12 分。</p><p>" +
      "<b>每千元幸福分</b> = 幸福度 ÷ 净成本 × 1,000，即每花 ¥1,000 真实成本能买到多少幸福分，按它从高到低排就是性价比榜。现在是" +
      esc(currentSeason.label) +
      "季；价格为 " +
      esc(formatDate(DATA.catalogMeta.priceSnapshot || DATA.updatedAt)) +
      " 前后的公开快照，闪促仅计入已核实的活动。</p></details>" +
      "</section></div>"
    );
  }

  function renderSavedHotels() {
    const list = DATA.hotels.filter((hotel) => favorites.has(hotel.id));
    if (!list.length) {
      return emptyState(
        "还没有收藏酒店",
        "在地图或酒店详情中收藏候选，之后可以在同一张行程卡里比较。",
        "去地图找酒店",
        "go-map"
      );
    }
    return '<div class="favorite-list">' + list.map((hotel) => hotelCard(hotel)).join("") + "</div>";
  }

  function renderCompare() {
    const hotels = DATA.hotels.filter((hotel) => comparisons.has(hotel.id));
    if (!hotels.length) {
      return emptyState(
        "还没有加入对比",
        "最多选择 4 家酒店，放在同一价格与人数口径下比较。",
        "查看酒店榜单",
        "go-rankings"
      );
    }
    const rows = [
      { label: "城市", value: (hotel) => LOGIC.getDestination(hotel.destinationId).name },
      { label: "位置", value: (hotel) => hotel.area },
      {
        label: "公开报价",
        value: (hotel) =>
          hasPrice(hotel) ? money(hotel.price) + " / 晚" : "官方渠道查价"
      },
      { label: "质量指数", value: (hotel) => qualityLabel(hotel) + " / 10" },
      {
        label: "总账估算",
        value: (hotel) =>
          money(
            LOGIC.calculateTripCost(
              LOGIC.getDestination(hotel.destinationId),
              hotel,
              state.params
            ).total
          )
      },
      { label: "适合", value: (hotel) => hotel.suitable.join("、") }
    ];
    return (
      '<div class="compare-scroll"><table class="compare-table"><thead><tr><th>维度</th>' +
      hotels
        .map(
          (hotel) =>
            "<th>" +
            esc(hotel.name) +
            '<br /><span class="muted" style="font-weight:400">' +
            hotel.brand +
            "</span></th>"
        )
        .join("") +
      "</tr></thead><tbody>" +
      rows
        .map((row) => {
          return (
            "<tr><th>" +
            row.label +
            "</th>" +
            hotels
              .map((hotel) => "<td>" + esc(row.value(hotel)) + "</td>")
              .join("") +
            "</tr>"
          );
        })
        .join("") +
      '<tr><th>操作</th>' +
      hotels
        .map(
          (hotel) =>
            '<td><button class="section-link" data-action="view-hotel" data-id="' +
            esc(hotel.id) +
            '">查看</button><br /><button class="section-link" data-action="remove-compare" data-id="' +
            esc(hotel.id) +
            '">移除</button></td>'
        )
        .join("") +
      "</tr></tbody></table></div>" +
      '<button class="btn btn-ghost" data-action="clear-compare" style="margin-top:8px">清空对比</button>'
    );
  }

  function renderTools() {
    const checkedCount = CHECKLIST_ITEMS.filter((item) => checklist[item.id]).length;
    return (
      '<div class="member-tool-grid">' +
      '<button class="member-tool" type="button" data-action="focus-points"><span class="tool-icon">' +
      icon("calculator") +
      "</span><strong>积分价值速算</strong><p>先算每万分价值，再判断现金和积分哪个更灵活。</p></button>" +
      '<button class="member-tool" type="button" data-action="focus-checklist"><span class="tool-icon">' +
      icon("check") +
      "</span><strong>入住前清单</strong><p>" +
      checkedCount +
      " / " +
      CHECKLIST_ITEMS.length +
      " 已完成。把不确定的事项在出发前问清。</p></button>" +
      "</div>" +
      '<section class="detail-section card" id="points-tool" style="margin-top:12px">' +
      "<h2>积分价值速算</h2>" +
      '<div class="calculator"><div class="field-grid">' +
      '<label class="field"><span>现金价（含税）</span><input id="points-cash-input" type="number" inputmode="numeric" min="0" step="50" value="' +
      esc(state.calc.cash) +
      '" /></label>' +
      '<label class="field"><span>所需积分</span><input id="points-points-input" type="number" inputmode="numeric" min="0" step="1000" value="' +
      esc(state.calc.points) +
      '" /></label>' +
      '</div><div class="calc-result" id="points-result"></div>' +
      '<p class="micro muted" style="margin:0">粗略比较，不含早餐、酒廊、取消政策和积分获取成本。积分或现金是否值得，应以官方可用性和个人估值决定。</p></div>' +
      "</section>" +
      '<section class="detail-section card" id="checklist-tool" style="margin-top:12px">' +
      '<div class="section-head"><div><h2>入住前确认</h2><p>按本次酒店和同行人选择</p></div><span class="micro muted">' +
      checkedCount +
      "/" +
      CHECKLIST_ITEMS.length +
      "</span></div>" +
      '<div class="check-list">' +
      CHECKLIST_ITEMS.map((item) => {
        return (
          '<label class="check-item"><input type="checkbox" data-check="' +
          item.id +
          '"' +
          (checklist[item.id] ? " checked" : "") +
          " /><span>" +
          esc(item.title) +
          "<small>" +
          esc(item.detail) +
          "</small></span></label>"
        );
      }).join("") +
      "</div></section>" +
      '<div class="method-note">' +
      icon("info") +
      "<span>提醒与清单首版保存在本机。尚未接入后台推送和官方会员账户；不会代替万豪官方权益说明。</span>" +
      "</div>"
    );
  }

  function normalizedPlannerDraft() {
    const fallbackDestination =
      LOGIC.getDestination(state.plannerDraft && state.plannerDraft.destinationId) ||
      LOGIC.getDestination(state.plannerDestinationId) ||
      LOGIC.getDestination(state.mapCity) ||
      initialMapDestination ||
      DATA.destinations[0];
    return Object.assign(
      {
        origin: state.params.departure || "上海",
        destinationId: fallbackDestination ? fallbackDestination.id : null,
        date: defaultTravelDate(1),
        days: 3,
        people: 2,
        budget: 5000,
        interest: "赏秋",
        notes: "",
        pace: "relaxed",
        travelStyle: state.params.travelStyle || "balanced"
      },
      state.plannerDraft || {},
      {
        destinationId: fallbackDestination ? fallbackDestination.id : null
      }
    );
  }

  function cleanCityName(value) {
    return String(value || "")
      .trim()
      .replace(/特别行政区$/, "")
      .replace(/自治州$/, "")
      .replace(/地区$/, "")
      .replace(/市$/, "");
  }

  function plannerInterestProfile(value) {
    const text = String(value || "").trim() || "城市漫游";
    const mappings = [
      { pattern: /秋|红叶|银杏|枫/, id: "autumn" },
      { pattern: /亲子|孩子|儿童|乐园/, id: "family" },
      { pattern: /历史|人文|博物馆|古迹/, id: "history" },
      { pattern: /自然|山|湖|森林|徒步|温泉/, id: "nature" },
      { pattern: /美食|餐厅|小吃|咖啡|市集/, id: "food" },
      { pattern: /城市|逛街|建筑|摄影/, id: "city" }
    ];
    const matched = mappings.find((item) => item.pattern.test(text));
    const base =
      PLANNER_INTERESTS.find((item) => item.id === (matched && matched.id)) ||
      PLANNER_INTERESTS.find((item) => item.id === "city");
    const terms = text
      .split(/[，,、/。；;\s]+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2);
    return Object.assign({}, base, {
      id: matched ? matched.id : "custom",
      label: text,
      keyword: terms[0] || base.keyword,
      terms
    });
  }

  function plannerInterestInputValue(value) {
    const text = String(value || "").trim();
    const known = PLANNER_INTERESTS.find((item) => item.id === text);
    return known ? known.label : text || "城市漫游";
  }

  function plannerPaceLabel(value) {
    if (value === "high") return "高强度 / 特种兵";
    if (value === "balanced") return "适中 / 多打卡";
    return "少走路 / 轻松";
  }

  function findDestinationByName(value) {
    const name = cleanCityName(value);
    if (!name) return null;
    const exact = DATA.destinations.filter(
      (destination) =>
        destination.name === name ||
        cleanCityName(destination.cityFull) === name ||
        cleanCityName(destination.province) === name
    );
    if (exact.length === 1) return exact[0];
    const partial = DATA.destinations.filter(
      (destination) =>
        destination.name.includes(name) || name.includes(destination.name)
    );
    return partial.length === 1 ? partial[0] : null;
  }

  function plannerDraftFromForm() {
    const destinationInput = document.getElementById("planner-destination");
    const destination = findDestinationByName(destinationInput.value);
    return {
      origin: document.getElementById("planner-origin").value.trim() || "上海",
      destinationId: destination ? destination.id : "",
      date: document.getElementById("planner-date").value || defaultTravelDate(1),
      days: Number(document.getElementById("planner-days").value) || 3,
      people: Number(document.getElementById("planner-people").value) || 2,
      budget: Number(document.getElementById("planner-budget").value) || 5000,
      interest:
        document.getElementById("planner-interest").value.trim() || "城市漫游",
      notes: document.getElementById("planner-notes").value.trim(),
      pace: document.getElementById("planner-pace").value || "relaxed",
      travelStyle: state.params.travelStyle || "balanced",
      hotelId:
        (state.plannerDraft && state.plannerDraft.hotelId) || ""
    };
  }

  function renderPlanDays(plan) {
    return (
      '<div class="plan-days">' +
      plan.days
        .map((day, index) => {
          return (
            '<article class="plan-day">' +
            '<header><span>DAY ' +
            (index + 1) +
            (day.date ? " · " + esc(day.date) : "") +
            "</span><strong>" +
            esc(day.title) +
            "</strong>" +
            (day.weather
              ? '<em class="plan-weather">' +
                esc(weatherSummary(day.weather)) +
                " · 高德天气</em>"
              : "") +
            "</header>" +
            '<div class="plan-entries">' +
            day.entries
              .map((entry) => {
                return (
                  '<div class="plan-entry"><span class="plan-time">' +
                  esc(entry.time) +
                  '</span><div><strong>' +
                  esc(entry.title) +
                  "</strong><p>" +
                  esc(entry.detail || "") +
                  "</p></div></div>"
                );
              })
              .join("") +
            "</div></article>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderMeituanAttractions(plan) {
    const attractions = (plan && plan.meituanGuide && plan.meituanGuide.attractions) || [];
    return (
      '<section class="detail-section card restaurant-section meituan-attractions-section">' +
      '<div class="section-head"><div><h2>美团推荐景点</h2><p>景点内容由美团酒旅 Skill 决定，位置由高德匹配</p></div><span class="mode-tag">美团 + 高德</span></div>' +
      (attractions.length
        ? '<div class="restaurant-list">' +
          attractions
            .map((item, index) => {
              return (
                '<article class="restaurant-card"><div><strong>' +
                (index + 1) +
                ". " +
                esc(item.name) +
                "</strong><p>" +
                esc(item.reason || item.category || "") +
                (item.address ? " · " + esc(item.address) : "") +
                "</p><span>高德位置：" +
                (item.amapLocated
                  ? "已定位"
                  : "暂未匹配，出发前请复核地址") +
                "</span></div>" +
                (Number(item.rating) > 0
                  ? '<em>' + Number(item.rating).toFixed(1) + " 分</em>"
                  : "") +
                "</article>"
              );
            })
            .join("") +
          "</div>"
        : '<p class="micro muted">美团暂未返回景点建议。' +
          esc(plan.meituanGuideError || "") +
          "</p>") +
      "</section>"
    );
  }

  function renderRestaurantRecommendations(plan) {
    const restaurants = (plan && plan.restaurants) || [];
    return (
      '<section class="detail-section card restaurant-section">' +
      '<div class="section-head"><div><h2>大众点评必吃榜与本地餐饮</h2><p>餐厅由美团酒旅 Skill 决定，距离由高德定位计算</p></div><span class="mode-tag">美团 + 高德</span></div>' +
      (restaurants.length
        ? '<div class="restaurant-list">' +
          restaurants
            .map((restaurant) => {
              return (
                '<article class="restaurant-card"><div><strong>' +
                esc(restaurant.name) +
                "</strong><p>" +
                esc(restaurant.reason || restaurant.category || "本地餐饮") +
                (restaurant.address ? " · " + esc(restaurant.address) : "") +
                "</p><span>" +
                esc(restaurant.source || "美团酒旅 Skill") +
                (Number.isFinite(Number(restaurant.distanceFromHotelKm))
                  ? " · 距建议酒店约 " +
                    Number(restaurant.distanceFromHotelKm).toFixed(1) +
                    " km"
                  : "") +
                "</span></div>" +
                (Number(restaurant.rating) > 0
                  ? '<em>' + Number(restaurant.rating).toFixed(1) + " 分</em>"
                  : "") +
                "</article>"
              );
            })
            .join("") +
          "</div>"
        : '<p class="micro muted">美团暂未返回可用餐厅。' +
          esc(plan.meituanGuideError || "") +
          "</p>") +
      '<div class="restaurant-source-note">' +
      icon("info") +
      "<span>餐厅名单来自美团酒旅 Skill，高德用于匹配坐标并计算到建议酒店的直线距离；营业时间、排队和必吃榜资格请以美团/大众点评门店页复核。</span></div>" +
      "</section>"
    );
  }

  function renderTripPlan(plan) {
    if (!plan) return "";
    const destination = LOGIC.getDestination(plan.destinationId);
    const hotel = LOGIC.getHotel(plan.hotelId);
    const route = plan.route || {};
    return (
      '<section class="planned-trip">' +
      '<div class="plan-title-row"><div><span class="eyebrow" style="color:#856634">Live trip plan</span><h2>' +
      esc(plan.origin) +
      " → " +
      esc(destination ? destination.name : plan.destinationName) +
      "</h2><p>" +
      esc(plan.date || "日期待确认") +
      " · 根据出发地、目的地与 " +
      plan.days.length +
      " 天行程生成 · 酒店偏好 " +
      esc(
        plan.travelStyle
          ? travelStyleLabel(plan.travelStyle)
          : travelStyleLabel(state.params.travelStyle)
      ) +
      '</p></div><span class="source-badge">美团景点餐饮 · 高德地图天气路线 · DeepSeek 汇总</span></div>' +
      (plan.notes
        ? '<p class="plan-user-note"><strong>补充需求</strong> ' +
          esc(plan.notes) +
          "</p>"
        : "") +
      '<div class="route-summary">' +
      '<div class="route-line"><span>' +
      esc(plan.origin) +
      "</span><i></i><span>" +
      esc(destination ? destination.name : plan.destinationName) +
      "</span></div>" +
      '<div class="route-stats"><div><strong>' +
      (route.distanceKm ? route.distanceKm + " km" : "待核验") +
      "</strong><span>驾车距离</span></div><div><strong>" +
      (route.durationMinutes ? formatDuration(route.durationMinutes * 60) : "待核验") +
      "</strong><span>预计用时</span></div><div><strong>" +
      (route.tollCost ? "¥" + route.tollCost : "—") +
      "</strong><span>过路费</span></div></div>" +
      (route.warning
        ? '<p class="micro muted" style="margin:9px 0 0">' + esc(route.warning) + "</p>"
        : "") +
      "</div>" +
      (plan.transport
        ? '<div class="transport-option"><div><span>飞猪交通参考</span><strong>' +
          esc(plan.transport.type) +
          " " +
          esc(plan.transport.number) +
          "</strong><p>" +
          esc(plan.transport.from) +
          " → " +
          esc(plan.transport.to) +
          " · " +
          esc(plan.transport.departAt) +
          (plan.transport.price
            ? " · 成人 " + money(plan.transport.price) + " 起"
            : "") +
          "</p></div>" +
          (isFliggyUrl(plan.transport.bookingUrl)
            ? '<button type="button" data-action="open-fliggy-booking" data-booking-url="' +
              esc(plan.transport.bookingUrl) +
              '">飞猪查看班次</button>'
            : plan.transport.bookingUrl
              ? '<a href="' +
                esc(plan.transport.bookingUrl) +
                '" target="_self">查看班次</a>'
              : "") +
          "</div>"
        : "") +
      (Number(plan.totalCost) > 0
        ? '<div class="plan-budget-summary"><span>当前酒店方案预计总花费</span><strong>' +
          money(plan.totalCost) +
          "</strong><em>" +
          (plan.budget
            ? plan.totalCost <= plan.budget
              ? "预算内 · 余 " + money(plan.budget - plan.totalCost)
              : "超预算 " + money(plan.totalCost - plan.budget)
            : "未设置预算") +
          "</em></div>"
        : "") +
      (plan.aiBrief
        ? '<div class="ai-plan-note"><span>DeepSeek 复合攻略</span><p>' +
          esc(plan.aiBrief) +
          "</p></div>"
        : "") +
      renderMeituanAttractions(plan) +
      renderRestaurantRecommendations(plan) +
      '<div class="plan-hotel-row">' +
      '<div><span class="micro muted">本次建议入住</span><strong>' +
      (hotel ? esc(hotel.name) : "待选择酒店") +
      "</strong><p>" +
      (hotel
        ? esc(hotel.brand) +
          " · " +
          (hasPrice(hotel)
            ? money(hotel.price) +
              " / 晚（" +
              priceSourceLabel(hotel) +
              " · " +
              formatDate(hotel.priceMeta && hotel.priceMeta.checkIn) +
              " 快照，非所选日期锁价）"
            : "官方渠道查价")
        : "暂未匹配到酒店") +
      "</p></div>" +
      (hotel
        ? '<button class="btn btn-secondary" data-action="view-hotel" data-id="' +
          esc(hotel.id) +
          '">酒店详情</button>'
        : "") +
      "</div>" +
      (plan.hotelOptions && plan.hotelOptions.length > 1
        ? '<label class="field planner-hotel-select"><span>更换建议酒店</span><select id="trip-hotel-select">' +
          plan.hotelOptions
            .map((option) => {
              return (
                '<option value="' +
                esc(option.hotelId) +
                '"' +
                (hotel && hotel.id === option.hotelId ? " selected" : "") +
                ">" +
                esc(option.name) +
                " · " +
                (Number(option.price) > 0 ? money(option.price) : "查价") +
                (Number(option.pointsPrice) > 0
                  ? " / " + Math.round(option.pointsPrice) + "分"
                  : "") +
                " · 预计" +
                money(option.totalCost) +
                (option.withinBudget ? "" : "（超预算）") +
                "</option>"
              );
            })
            .join("") +
          "</select></label>"
        : "") +
      renderPlanDays(plan) +
      '<div class="plan-actions">' +
      (plan.amapUri
        ? '<a class="btn btn-primary" href="' +
          esc(plan.amapUri) +
          '" target="_self">在高德地图打开路线</a>'
        : "") +
      '<button class="btn btn-secondary" data-action="focus-planner-form">修改规划</button>' +
      "</div>" +
      '<div class="method-note">' +
      icon("source") +
      "<span>景点与餐饮名单来自美团酒旅 Skill；坐标、天气、市内距离和逐日编排采用高德地图结果；酒店和交通参考来自飞猪；DeepSeek 只负责最终汇总。AI 汇总不代表实时班次、房态或官方承诺。生成时间 " +
      esc(formatDate(plan.generatedAt)) +
      "。营业时间、票价、余票、路况和最终房价请在出发前再次核验。</span>" +
      "</div></section>"
    );
  }

  function updateTripPlanHotel(hotelId) {
    const plan = state.tripPlan;
    const hotel = LOGIC.getHotel(hotelId);
    const destination = plan
      ? LOGIC.getDestination(plan.destinationId)
      : null;
    if (!plan || !hotel || !destination) return;
    const cost = LOGIC.calculateTripCost(destination, hotel, {
      departure: plan.origin,
      days: plan.days.length,
      people: plan.people || 2,
      rooms: plan.rooms || 1,
      budget: plan.budget || 0
    });
    const totalCost = plannerTotalCost(cost, plan.transport, plan.people);
    plan.hotelId = hotel.id;
    plan.hotelName = hotel.name;
    plan.totalCost = totalCost;
    plan.lodgingCost = cost.lodging;
    const option = (plan.hotelOptions || []).find(
      (item) => item.hotelId === hotel.id
    );
    if (option) {
      option.totalCost = totalCost;
      option.lodging = cost.lodging;
      option.withinBudget = !plan.budget || totalCost <= plan.budget;
    }
    const firstDay = plan.days && plan.days[0];
    if (firstDay && Array.isArray(firstDay.entries)) {
      const stayEntry = firstDay.entries.find((entry) =>
        /^入住 /.test(entry.title || "")
      );
      if (stayEntry) {
        stayEntry.title = "入住 " + hotel.name;
      }
    }
    state.plannerDraft = Object.assign({}, state.plannerDraft, {
      hotelId: hotel.id
    });
    safeWrite("lvban.plannerDraft.v1", state.plannerDraft);
    safeWrite("lvban.tripPlan.v1", plan);
    const scrollY = window.scrollY;
    render();
    window.scrollTo(0, scrollY);
    showToast("已切换酒店并更新预计总花费");
  }

  function renderPlanner() {
    const draft = normalizedPlannerDraft();
    const destination = LOGIC.getDestination(draft.destinationId);
    return (
      '<section class="card planner-form-card" id="planner-form-card">' +
      '<div class="section-head"><div><h2>旅行规划</h2><p>输入出发地和目的地，联网生成可执行方案</p></div>' +
      icon("compass") +
      "</div>" +
      '<form id="planner-form">' +
      '<div class="field-grid">' +
      '<label class="field"><span>出发地</span><input id="planner-origin" value="' +
      esc(draft.origin) +
      '" placeholder="城市、机场或车站" /></label>' +
      '<label class="field"><span>目的地</span><input id="planner-destination" list="planner-destination-options" value="' +
      esc(destination ? destination.name : "") +
      '" placeholder="输入城市" /><datalist id="planner-destination-options">' +
      DATA.destinations
        .map((item) => "<option value=\"" + esc(item.name) + "\"></option>")
        .join("") +
      "</datalist></label>" +
      '<label class="field"><span>出发日期</span><input id="planner-date" type="date" min="' +
      defaultTravelDate(0) +
      '" value="' +
      esc(draft.date || defaultTravelDate(1)) +
      '" /></label>' +
      '<label class="field"><span>旅行天数</span><select id="planner-days">' +
      countOptions(1, 7, draft.days, " 天") +
      "</select></label>" +
      '<label class="field"><span>出行人数</span><select id="planner-people">' +
      countOptions(1, 6, draft.people, " 人") +
      "</select></label>" +
      '<label class="field"><span>预算</span><input id="planner-budget" type="number" min="500" step="100" value="' +
      esc(draft.budget) +
      '" /></label>' +
      '<label class="field full"><span>主要兴趣</span><input id="planner-interest" value="' +
      esc(plannerInterestInputValue(draft.interest)) +
      '" placeholder="自由输入，例如：赏秋、咖啡、博物馆、亲子少走路" /></label>' +
      '<label class="field full"><span>补充需求 / 备注</span><textarea id="planner-notes" rows="3" placeholder="例如：有老人，电梯少换乘；想吃本地菜；每晚预算不超过 900；希望酒店有泳池和行政酒廊">' +
      esc(draft.notes || "") +
      "</textarea></label>" +
      '<label class="field"><span>旅行节奏</span><select id="planner-pace">' +
      '<option value="relaxed"' +
      (draft.pace === "relaxed" ? " selected" : "") +
      ">少走路 / 轻松</option>" +
      '<option value="balanced"' +
      (draft.pace === "balanced" ? " selected" : "") +
      ">适中 / 多打卡</option>" +
      '<option value="high"' +
      (draft.pace === "high" ? " selected" : "") +
      ">高强度 / 特种兵</option>" +
      "</select></label>" +
      "</div>" +
      '<button class="btn btn-primary btn-block" style="margin-top:12px" type="submit"' +
      (state.plannerLoading ? " disabled" : "") +
      ">" +
      icon("spark") +
      (state.plannerLoading ? "正在联网规划…" : "生成旅行计划") +
      "</button>" +
      "</form>" +
      (state.plannerError
        ? '<div class="planner-status error">' +
          esc(state.plannerError) +
          "</div>"
        : "") +
      (state.plannerLoading
        ? '<div class="planner-status loading">正在用美团确定景点与餐饮，用高德匹配坐标、天气和逐日路线，再由 DeepSeek 汇总；同时核验酒店与交通。首次查询通常需要 20—120 秒，后续会使用本地缓存…</div>'
        : "") +
      "</section>" +
      renderTripPlan(state.tripPlan)
    );
  }

  function normalizeFlyAiPoi(item) {
    const latitude = Number(item && item.latitude);
    const longitude = Number(item && item.longitude);
    if (!item || !item.name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    const ticketInfo = item.ticketInfo || {};
    const foodLike = /美食|餐饮|餐厅|小吃|火锅|烧烤|菜馆|面馆|咖啡/.test(
      String(item.category || "") + String(item.name || "")
    );
    return {
      id: "flyai-poi-" + String(item.id || item.name),
      name: cleanHotelText(item.name),
      address: cleanHotelText(item.address),
      type: cleanHotelText(item.category || item.listRank || "景点"),
      category: cleanHotelText(item.category || "景点"),
      rating: Number(item.rate || ticketInfo.rate) || null,
      location: [longitude, latitude],
      description: cleanHotelText(item.description || "").slice(0, 360),
      ticketPrice: ticketInfo.price || null,
      ticketName: ticketInfo.ticketName || "",
      listRank: item.listRank || "",
      imageUrl: item.mainPic || null,
      bookingUrl: item.jumpUrl || null,
      source: foodLike ? "飞猪本地餐饮" : "飞猪景点搜索"
    };
  }

  function mergePlannerPlaces(flyAiPlaces, amapPlaces) {
    const seen = new Set();
    const merged = [];
    [...flyAiPlaces, ...amapPlaces].forEach((place) => {
      const key = normalizeHotelKey(place && place.name);
      if (!place || !key || seen.has(key)) return;
      seen.add(key);
      merged.push(place);
    });
    return merged;
  }

  function normalizeFlyAiTransport(payload) {
    const item = getFlyAiItems(payload)[0];
    if (!item || !Array.isArray(item.journeys) || !item.journeys.length) {
      return null;
    }
    const journey = item.journeys[0];
    const segments = Array.isArray(journey.segments) ? journey.segments : [];
    if (!segments.length) return null;
    const first = segments[0];
    const last = segments[segments.length - 1];
    const durationMatch = String(
      journey.totalDuration || item.totalDuration || first.duration || ""
    ).match(/\d+/);
    return {
      type:
        first.transportType ||
        (first.marketingTransportNo && /^[A-Z]{2}\d+/.test(first.marketingTransportNo)
          ? "飞机"
          : "火车"),
      number: first.marketingTransportNo || "",
      carrier: first.marketingTransportName || "",
      from: [first.depStationName, first.depTerm].filter(Boolean).join(" "),
      to: [last.arrStationName, last.arrTerm].filter(Boolean).join(" "),
      departAt: first.depDateTime || "",
      arriveAt: last.arrDateTime || "",
      durationMinutes: durationMatch ? Number(durationMatch[0]) : null,
      seatClass: first.seatClassName || "",
      price: parseFlyAiPrice(item.adultPrice || item.price),
      bookingUrl: item.jumpUrl || null,
      journeyType: journey.journeyType || ""
    };
  }

  function markdownToReadableText(value) {
    return String(value || "")
      .replace(/<spot_entity>name:([^;]+);[^<]*<\/spot_entity>/g, "$1")
      .replace(/<\/?[^>]+>/g, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/^#{1,6}\s*/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\[([^\]]+)\]\((?:https?:\/\/)[^)]+\)/g, "$1")
      .replace(/^\s*[-*]\s+/gm, "• ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function normalizeAmapPoi(poi, categoryHint) {
    if (!poi || !poi.location) return null;
    const parts = String(poi.location).split(",").map(Number);
    if (!Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
    return {
      id: poi.id || poi.name,
      name: poi.name,
      address: poi.address === [] ? "" : poi.address || "",
      type: poi.type || "",
      category: categoryHint || "",
      rating: poi.biz_ext && poi.biz_ext.rating ? Number(poi.biz_ext.rating) : null,
      location: parts,
      source: categoryHint === "当地美食" ? "高德地图餐饮" : "高德地图"
    };
  }

  function isFoodPlace(place) {
    return /美食|餐饮|餐厅|小吃|火锅|烧烤|菜馆|面馆|咖啡|市集|本地菜/.test(
      String((place && (place.category || place.type || place.name)) || "")
    );
  }

  function buildRestaurantRecommendations(places, hotel) {
    const hotelPoint =
      hotel && hotel.coords
        ? [hotel.coords.longitude, hotel.coords.latitude]
        : null;
    const seen = new Set();
    return (places || [])
      .filter(isFoodPlace)
      .filter((place) => {
        const key = normalizeHotelKey(place.name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8)
      .map((place) => ({
        name: cleanHotelText(place.name),
        category: cleanHotelText(place.category || place.type || "本地餐饮"),
        address: cleanHotelText(place.address || ""),
        reason: cleanHotelText(place.reason || place.description || ""),
        rating: Number.isFinite(Number(place.rating))
          ? Number(place.rating)
          : null,
        distanceFromHotelKm: plannerStraightLineKm(
          hotelPoint,
          place.location
        ),
        source: place.source || "公开餐饮搜索结果",
        bookingUrl: place.bookingUrl || null
      }));
  }

  function classifyMeituanAttraction(item) {
    const text = String((item && (item.name + item.reason + item.category)) || "");
    if (/博物馆|古城|古镇|寺|陵|遗址|城墙|故居|历史|人文|纪念馆/.test(text)) {
      return "名胜古迹";
    }
    if (/公园|山|湖|森林|湿地|风景|自然|河|岛|园/.test(text)) {
      return "自然风光";
    }
    return "城市体验";
  }

  function amapPoiForGuideItem(item, payload) {
    const pois = (payload && payload.pois) || [];
    const target = normalizeHotelKey(item && item.name);
    const match =
      pois.find((poi) => normalizeHotelKey(poi.name) === target) ||
      pois.find((poi) => {
        const name = normalizeHotelKey(poi.name);
        return (
          name.length >= 4 &&
          target.length >= 4 &&
          (name.includes(target) || target.includes(name))
        );
      }) ||
      pois[0] ||
      null;
    if (!match || !match.location) return null;
    const parts = String(match.location).split(",").map(Number);
    if (!Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
    return {
      location: parts,
      amapName: cleanHotelText(match.name),
      address: cleanHotelText(
        item.address || (match.address === [] ? "" : match.address) || ""
      ),
      type: cleanHotelText(match.type),
      rating:
        match.biz_ext && Number.isFinite(Number(match.biz_ext.rating))
          ? Number(match.biz_ext.rating)
          : null
    };
  }

  async function resolveMeituanGuidePlaces(destination, guide) {
    const enrich = async (items, kind) => {
      const results = await Promise.allSettled(
        items.map((item) =>
          requestAmap("place/text", {
            keywords: item.name,
            city: destination.name,
            citylimit: "true",
            offset: "10",
            page: "1",
            extensions: "base"
          })
        )
      );
      return items.map((item, index) => {
        const result = results[index];
        const poi =
          result && result.status === "fulfilled"
            ? amapPoiForGuideItem(item, result.value)
            : null;
        return Object.assign({}, item, {
          category:
            kind === "restaurant"
              ? "当地美食"
              : classifyMeituanAttraction(item),
          location: poi ? poi.location : null,
          address: poi && poi.address ? poi.address : item.address,
          type: poi ? poi.type : "",
          rating: poi ? poi.rating : null,
          source: "美团酒旅 Skill",
          amapLocated: Boolean(poi)
        });
      });
    };
    const [attractions, restaurants] = await Promise.all([
      enrich((guide.attractions || []).slice(0, 6), "attraction"),
      enrich((guide.restaurants || []).slice(0, 6), "restaurant")
    ]);
    return { attractions, restaurants };
  }

  function buildTripDays(destination, hotel, places, origin, route, transport) {
    const hotelPoint = hotel && hotel.coords
      ? [hotel.coords.longitude, hotel.coords.latitude]
      : destination.coords
        ? [destination.coords.longitude, destination.coords.latitude]
        : null;
    const sortedPlaces = places
      .slice()
      .map((place) => ({
        ...place,
        distanceKm: plannerStraightLineKm(hotelPoint, place.location)
      }))
      .sort((a, b) => (a.distanceKm || 9999) - (b.distanceKm || 9999));
    const categoryOf = (place) =>
      String((place && (place.category || place.type)) || "");
    const requiredCategories = [
      { key: "当地美食", pattern: /美食|餐饮|小吃|市集/ },
      { key: "自然风光", pattern: /自然|公园|风景|湖|山/ },
      { key: "名胜古迹", pattern: /历史|古迹|博物馆|人文/ }
    ];
    const prioritized = [];
    const usedNames = new Set();
    requiredCategories.forEach((category) => {
      const place = sortedPlaces.find(
        (item) =>
          category.pattern.test(categoryOf(item)) &&
          !usedNames.has(normalizeHotelKey(item.name))
      );
      if (place) {
        prioritized.push(place);
        usedNames.add(normalizeHotelKey(place.name));
      }
    });
    sortedPlaces.forEach((place) => {
      const key = normalizeHotelKey(place.name);
      if (!usedNames.has(key)) {
        prioritized.push(place);
        usedNames.add(key);
      }
    });
    const ordered = prioritized;
    const foodPlace = ordered.find((place) =>
      /美食|餐饮|小吃|市集/.test(categoryOf(place))
    );
    let foodAdded = false;
    const totalDays = Math.max(1, Number(state.plannerDraft.days) || 3);
    const pace = state.plannerDraft.pace || "relaxed";
    const middlePlaces = pace === "high" ? 3 : pace === "balanced" ? 2 : 1;
    const detailForPlace = (place) => {
      const distance =
        place.distanceKm == null ? null : Number(place.distanceKm);
      return (
        (place.category ? place.category + "。" : "") +
        (place.type ? place.type + "。" : "") +
        (place.address ? "地址：" + place.address + "。" : "") +
        (place.description ? place.description + "。" : "") +
        (place.ticketName
          ? "门票参考：" +
            place.ticketName +
            (place.ticketPrice ? " " + place.ticketPrice : "") +
            "。"
          : "") +
        (Number.isFinite(distance) && distance >= 0
          ? "距酒店直线约 " + distance.toFixed(1) + " km。"
          : "")
      );
    };
    let placeIndex = 0;
    const usedEntryPlaceKeys = new Set();
    const addPlaceEntry = (entries, place, time) => {
      const key = normalizeHotelKey(place && place.name);
      if (!key || usedEntryPlaceKeys.has(key)) return false;
      usedEntryPlaceKeys.add(key);
      entries.push({
        time,
        title: place.name,
        detail: detailForPlace(place)
      });
      return true;
    };
    return Array.from({ length: totalDays }, (_, dayIndex) => {
      const isFirst = dayIndex === 0;
      const isLast = dayIndex === totalDays - 1;
      const entries = [];
      if (isFirst) {
        entries.push({
          time: "上午",
          title: "从" + origin + "前往" + destination.name,
          detail:
            transport
              ? transport.type +
                (transport.number ? " " + transport.number : "") +
                "，" +
                (transport.departAt || "班次时间待确认") +
                " → " +
                (transport.arriveAt || "抵达时间待确认") +
                "。" +
                (transport.price ? "成人票价约 " + money(transport.price) + "。" : "") +
                "出发前请再次核验余票与中国铁路/航司通知。"
              : route && route.distanceKm
              ? "驾车约 " +
                route.distanceKm +
                " 公里，" +
                formatDuration(route.durationMinutes * 60) +
                "。抵达后先办理入住或寄存行李。"
              : "建议使用高德地图确认当天班次、路况和抵达时间。"
        });
        if (hotel) {
          entries.push({
            time: "下午",
            title: "入住 " + hotel.name,
            detail: "先确认床型、早餐和取消政策，再安排当天活动。"
          });
        }
        if (places[placeIndex] && !isLast) {
          const place = places[placeIndex];
          placeIndex += 1;
          addPlaceEntry(entries, place, "傍晚");
        }
      }
      if (isLast) {
        if (places[placeIndex]) {
          const lastPlace = places[placeIndex];
          placeIndex += 1;
          addPlaceEntry(entries, lastPlace, "上午");
        }
        entries.push({
          time: "下午",
          title: "返回" + origin,
          detail: "返程前留足取行李、到站和安检时间。"
        });
      } else if (!isFirst) {
        const timeSlots = ["上午", "下午", "晚间"];
        for (let slot = 0; slot < middlePlaces; slot += 1) {
          const place = places[placeIndex];
          if (!place) break;
          placeIndex += 1;
          addPlaceEntry(entries, place, timeSlots[slot] || "下午");
        }
        if (middlePlaces < 3) {
          entries.push({
            time: "晚间",
            title: "回到酒店周边用餐和休息",
            detail: "按当天体力调整，不临时增加跨区硬景点。"
          });
        }
      }
      if (!entries.length) {
        entries.push({
          time: "全天",
          title: "酒店周边自由活动",
          detail: "保留弹性时间，按当天天气和体力调整。"
        });
      }
      if (
        foodPlace &&
        entries.some((entry) => entry.title === foodPlace.name)
      ) {
        foodAdded = true;
      }
      if (
        !foodAdded &&
        !isLast &&
        foodPlace &&
        !entries.some(
          (entry) =>
            entry.title === foodPlace.name ||
            /当地美食|餐饮|小吃/.test(entry.detail || "")
        )
      ) {
        foodAdded = addPlaceEntry(entries, foodPlace, "晚间");
      }
      return {
        title: isFirst
          ? "抵达与第一印象"
          : isLast
            ? "收尾与返程"
            : pace === "high"
              ? "高强度打卡"
              : pace === "balanced"
                ? "适中节奏"
                : "轻松深游",
        entries
      };
    });
  }

  async function runTripPlanner(draftInput) {
    const draft = Object.assign(
      {
        origin: "上海",
        destinationId: "",
        date: defaultTravelDate(1),
        days: 3,
        people: 2,
        budget: 5000,
        interest: "赏秋",
        notes: "",
        pace: "relaxed",
        travelStyle: state.params.travelStyle || "balanced"
      },
      draftInput || {}
    );
    const destination = LOGIC.getDestination(draft.destinationId);
    if (!destination) {
      showToast("请选择有效目的地");
      return;
    }
    state.plannerDraft = draft;
    state.plannerDestinationId = draft.destinationId;
    state.plannerLoading = true;
    state.plannerError = "";
    safeWrite("lvban.plannerDraft.v1", draft);
    render();

    try {
      state.params.departure = draft.origin;
      state.params.days = draft.days;
      state.params.people = draft.people;
      state.params.budget = draft.budget;
      state.params.lowWalking = draft.pace === "relaxed";
      state.params.travelStyle =
        draft.travelStyle === "distinctive" ? "distinctive" : "balanced";
      persistPrefs();
      const interest = plannerInterestProfile(draft.interest);
      const checkOutDate = addDaysToDate(
        draft.date,
        Math.max(1, Number(draft.days) - 1)
      );
      const settle = (promise) =>
        promise.then(
          (value) => ({ status: "fulfilled", value }),
          (reason) => ({ status: "rejected", reason })
        );
      const flyAiHotelPromise = settle(
        requestFlyAi("search_marriott_hotels", {
          destName: destination.cityFull || destination.name,
          checkInDate: draft.date,
          checkOutDate,
          sort: "price_asc"
        })
      );
      const meituanGuidePromise = settle(
        requestMeituanGuide(destination.name, draft, interest)
      );
      const destinationAddress = destination.cityFull || destination.name;
      const [originGeoResult, destinationGeoResult] = await Promise.allSettled([
        requestAmap("geocode/geo", { address: draft.origin, city: "全国" }),
        requestAmap("geocode/geo", {
          address: destinationAddress,
          city: destination.province || "全国"
        })
      ]);
      const originGeo =
        originGeoResult.status === "fulfilled"
          ? originGeoResult.value.geocodes && originGeoResult.value.geocodes[0]
          : null;
      const destinationGeo =
        destinationGeoResult.status === "fulfilled"
          ? destinationGeoResult.value.geocodes &&
            destinationGeoResult.value.geocodes[0]
          : null;
      const originLocation = originGeo
        ? originGeo.location.split(",").map(Number)
        : null;
      const destinationLocation = destinationGeo
        ? destinationGeo.location.split(",").map(Number)
        : destination.coords
          ? [destination.coords.longitude, destination.coords.latitude]
          : null;
      if (!destinationLocation) {
        throw new Error("高德未能定位目的地，请改填更具体的城市名");
      }
      const weatherCity =
        (destinationGeo && destinationGeo.adcode) || destination.name;
      const weatherPromise = settle(
        requestAmap("weather/weatherInfo", {
          city: weatherCity,
          extensions: "all"
        })
      );
      const routePromise = originLocation
        ? settle(
            requestAmap("direction/driving", {
              origin: originLocation.join(","),
              destination: destinationLocation.join(","),
              extensions: "base",
              strategy: "0"
            })
          )
        : Promise.resolve({
            status: "rejected",
            reason: new Error("未定位到出发地")
          });
      const longDistance =
        plannerStraightLineKm(originLocation, destinationLocation) > 900;
      const transportTool = longDistance
        ? "search_flight"
        : "search_domestic_train";
      const transportPromise = settle(
        requestFlyAi(transportTool, {
          origin: draft.origin,
          destination: destination.name,
          depDate: draft.date,
          journeyType: 1,
          sortType: 3,
          limit: 10
        })
      );
      const [
        routeResult,
        flyAiHotelResult,
        flyAiTransportResult,
        meituanGuideResult,
        weatherResult
      ] = await Promise.all([
        routePromise,
        flyAiHotelPromise,
        transportPromise,
        meituanGuidePromise,
        weatherPromise
      ]);
      let hotelMerge = null;
      if (flyAiHotelResult.status === "fulfilled") {
        try {
          hotelMerge = mergeFlyAiHotelResults(
            destination,
            flyAiHotelResult.value,
            draft.date,
            checkOutDate
          );
        } catch (error) {
          hotelMerge = null;
        }
      }
      const weather =
        weatherResult.status === "fulfilled"
          ? normalizeAmapWeather(weatherResult.value)
          : [];
      const weatherError =
        weatherResult.status === "rejected"
          ? weatherResult.reason && weatherResult.reason.message
            ? weatherResult.reason.message
            : "高德天气暂不可用"
          : "";
      let meituanGuide = { attractions: [], restaurants: [] };
      if (meituanGuideResult.status === "fulfilled") {
        meituanGuide = await resolveMeituanGuidePlaces(
          destination,
          meituanGuideResult.value
        );
      }
      const meituanGuideError =
        meituanGuideResult.status === "rejected"
          ? meituanGuideResult.reason &&
            meituanGuideResult.reason.message
            ? meituanGuideResult.reason.message
            : "美团景点与美食查询暂不可用"
          : "";
      const places = mergePlannerPlaces(
        meituanGuide.attractions,
        meituanGuide.restaurants
      );
      const routeData =
        routeResult.status === "fulfilled" &&
        routeResult.value.route &&
        routeResult.value.route.paths &&
        routeResult.value.route.paths[0];
      const route = routeData
        ? {
            distanceKm: Math.round(Number(routeData.distance) / 100) / 10,
            durationMinutes: Math.round(Number(routeData.duration) / 60),
            tollCost: Number(routeData.tolls) || 0,
            warning: ""
          }
        : {
            distanceKm: null,
            durationMinutes: null,
            tollCost: 0,
            warning:
              "高德路线暂未返回驾车方案；行程仍使用飞猪交通与地点结果生成，出发前请重新确认交通。"
          };
      const hotelCandidates = plannerHotelCandidates(destination, draft);
      const selectedHotelCandidate =
        hotelCandidates.find(
          (item) =>
            draft.hotelId && item.hotel.id === draft.hotelId
        ) ||
        hotelCandidates[0] ||
        null;
      const hotel = selectedHotelCandidate
        ? selectedHotelCandidate.hotel
        : null;
      const restaurants = buildRestaurantRecommendations(
        meituanGuide.restaurants,
        hotel
      );
      const hotelOptions = hotelCandidates.map((item) => ({
        hotelId: item.hotel.id,
        name: item.hotel.name,
        brand: item.hotel.brand,
        price: hasPrice(item.hotel) ? item.hotel.price : null,
        pointsPrice:
          Number(item.hotel.pointsPrice) > 0
            ? item.hotel.pointsPrice
            : null,
        totalCost: item.cost.total,
        lodging: item.cost.lodging,
        withinBudget: item.withinBudget,
        noteBoost: item.noteBoost,
        quality: item.hotel.quality
      }));
      if (hotel) {
        draft.hotelId = hotel.id;
        state.plannerDraft = Object.assign({}, state.plannerDraft, {
          hotelId: hotel.id
        });
        safeWrite("lvban.plannerDraft.v1", state.plannerDraft);
      }
      const transport =
        flyAiTransportResult.status === "fulfilled"
          ? normalizeFlyAiTransport(flyAiTransportResult.value)
          : null;
      hotelOptions.forEach((option) => {
        const candidate = hotelCandidates.find(
          (item) => item.hotel.id === option.hotelId
        );
        if (!candidate) return;
        option.totalCost = plannerTotalCost(
          candidate.cost,
          transport,
          draft.people
        );
        option.withinBudget =
          !draft.budget || option.totalCost <= Number(draft.budget);
      });
      const selectedTotalCost = selectedHotelCandidate
        ? plannerTotalCost(
            selectedHotelCandidate.cost,
            transport,
            draft.people
          )
        : null;
      const planDays = buildTripDays(
        destination,
        hotel,
        places,
        draft.origin,
        route,
        transport
      );
      planDays.forEach((day, index) => {
        day.date = addDaysToDate(draft.date, index);
        day.weather = weatherForDate(weather, day.date, index);
      });
      const amapUri =
        originLocation && destinationLocation
          ? "amapuri://route/plan/?sid=BGVIS1&slat=" +
            originLocation[1] +
            "&slon=" +
            originLocation[0] +
            "&sname=" +
            encodeURIComponent(draft.origin) +
            "&did=BGVIS2&dlat=" +
            destinationLocation[1] +
            "&dlon=" +
            destinationLocation[0] +
            "&dname=" +
            encodeURIComponent(destination.name) +
            "&dev=0&t=0"
          : null;
      let aiBrief = null;
      let aiError = null;
      try {
        const facts = {
          date: draft.date,
          origin: draft.origin,
          destination: destination.name,
          days: draft.days,
          people: draft.people,
          budget: draft.budget,
          travelStyle: travelStyleLabel(draft.travelStyle),
          interest: draft.interest,
          pace: plannerPaceLabel(draft.pace),
          notes: draft.notes || "",
          route,
          transport,
          weather,
          dailyPlan: planDays.map((day) => ({
            date: day.date,
            title: day.title,
            weather: day.weather,
            entries: day.entries
          })),
          hotel: hotel
            ? {
                name: hotel.name,
                brand: hotel.brand,
                rating: hotel.rating,
                reviewCount: hotel.reviewCount,
                price: hasPrice(hotel) ? hotel.price : null,
                pointsPrice:
                  Number(hotel.pointsPrice) > 0
                    ? hotel.pointsPrice
                    : null
              }
            : null,
          hotelOptions: hotelOptions.slice(0, 8),
          meituanGuide: {
            attractions: meituanGuide.attractions,
            restaurants: meituanGuide.restaurants
          }
        };
        aiBrief = await requestDeepSeek(
          "请汇总下面的结构化事实，写一份完整出行规划。景点和餐厅名单只能采用美团酒旅 Skill 返回的内容；坐标、天气、路线和每日顺序采用了高德地图结果；酒店与交通事实另有来源。" +
            "你的职责是把这些事实汇总成用户易读的完整方案，不得新增未提供的地点、评分、天气或营业时间。" +
            "输出必须包含每日天气、上午/下午/晚间安排、当地美食、自然风光或名胜古迹、住宿、预算取舍和出发前核验提醒。" +
            "必须覆盖用户备注中的约束和酒店偏好。若偏好为“别具一格”，优先解释设计酒店、历史建筑和在地文化体验；若为“性价比和质量平衡”，不要把最低价等同于最高性价比。" +
            "如某一天高德只给出直线距离或天气超出预报范围，要明确说明。" +
            "用中文分段落写 500—800 字，不使用 Markdown 标记。事实：" +
            JSON.stringify(facts)
        );
      } catch (error) {
        aiError =
          error && error.message ? error.message : "DeepSeek 复合攻略暂不可用";
      }
      const flyAiErrors = [
        flyAiHotelResult,
        flyAiTransportResult
      ]
        .filter((result) => result.status === "rejected")
        .map((result) =>
          result.reason && result.reason.message ? result.reason.message : ""
        )
        .filter(Boolean);
      state.tripPlan = {
        origin: draft.origin,
        destinationId: destination.id,
        destinationName: destination.name,
        date: draft.date,
        days: planDays,
        people: Number(draft.people) || 2,
        rooms: 1,
        route,
        transport,
        hotelId: hotel ? hotel.id : null,
        hotelName: hotel ? hotel.name : null,
        hotelOptions,
        restaurants,
        meituanGuide,
        meituanGuideError,
        weather,
        weatherError,
        totalCost: selectedTotalCost,
        lodgingCost: selectedHotelCandidate
          ? selectedHotelCandidate.cost.lodging
          : null,
        budget: Number(draft.budget) || 0,
        travelStyle:
          draft.travelStyle === "distinctive" ? "distinctive" : "balanced",
        notes: draft.notes || "",
        amapUri,
        placesCount: places.length,
        flyAiHotelCount: hotelMerge ? hotelMerge.priced : 0,
        placeCategories: places.map((place) => ({
          name: place.name,
          category: place.category || "",
          type: place.type || ""
        })),
        aiBrief,
        aiError,
        flyAiErrors,
        generatedAt: new Date().toISOString(),
        source:
          "美团酒旅景点与餐饮 + 高德坐标/天气/路线与日内编排 + 飞猪酒店/交通 + DeepSeek 综合汇总"
      };
      safeWrite("lvban.tripPlan.v1", state.tripPlan);
      if (!places.length) {
        state.plannerError =
          "高德已返回路线，但美团没有返回可用的景点或餐厅。请调整兴趣或稍后重试。";
      }
    } catch (error) {
      state.plannerError =
        "联网规划失败：" +
        (error && error.message ? error.message : "请检查网络后重试");
    } finally {
      state.plannerLoading = false;
      const scrollY = window.scrollY;
      render();
      window.scrollTo(0, scrollY);
    }
  }

  function startHomeOnlinePlan() {
    const destinationInput = document.getElementById("destination-input");
    const destination = findDestinationByName(destinationInput.value);
    if (!destination) {
      showToast("请先在目的地栏输入一个已收录万豪酒店的城市");
      destinationInput.focus();
      return;
    }
    const origin =
      document.getElementById("departure-input").value.trim() || "上海";
    const date =
      document.getElementById("date-input").value || defaultTravelDate(1);
    const days = Number(document.getElementById("days-input").value) || 3;
    const people = Number(document.getElementById("people-input").value) || 2;
    const budget = Number(document.getElementById("budget-input").value) || 5000;
    const query = document.getElementById("query-input").value || "";
    const parsed = LOGIC.parseQuery(query, {
      styles: [],
      lowWalking: state.params.lowWalking
    });
    const interestMap = {
      赏秋: "autumn",
      城市漫游: "city",
      自然: "nature",
      亲子: "family",
      美食: "food"
    };
    const interest =
      (parsed.styles || [])
        .map((style) => interestMap[style])
        .find(Boolean) || "city";
    const draft = {
      origin,
      destinationId: destination.id,
      date,
      days,
      people,
      budget,
      interest,
      pace: parsed.lowWalking ? "relaxed" : "balanced",
      travelStyle: state.params.travelStyle || "balanced"
    };
    state.params.departure = origin;
    state.params.destinationName = destination.name;
    state.params.date = date;
    state.params.days = days;
    state.params.people = people;
    state.params.budget = budget;
    state.tripTab = "planner";
    state.plannerDraft = draft;
    state.plannerDestinationId = destination.id;
    state.tripPlan = null;
    state.plannerError = "";
    safeWrite("lvban.plannerDraft.v1", draft);
    persistPrefs();
    navigate("trip", { navContext: "trip" });
    window.setTimeout(() => runTripPlanner(draft), 80);
  }

  function renderTrip() {
    const tabs = [
      { id: "planner", label: "规划行程" },
      { id: "saved", label: "收藏 " + favorites.size },
      { id: "compare", label: "对比 " + comparisons.size },
      { id: "tools", label: "会员工具" }
    ];
    return (
      '<div class="screen">' +
      '<div class="section-head"><div><h1 class="page-title">我的行程</h1><p class="page-subtitle">把短名单、预算和入住准备放在一起</p></div>' +
      '<button class="icon-button" data-action="open-settings" aria-label="编辑出行偏好">' +
      icon("settings") +
      "</button></div>" +
      '<div class="profile-banner">' +
      '<span class="profile-avatar">' +
      esc((state.params.departure || "上").slice(0, 1)) +
      "</span>" +
      "<div><strong>" +
      esc(state.params.departure) +
      "出发 · 酒店偏好</strong><p>" +
      esc(travelStyleLabel(state.params.travelStyle)) +
      " · " +
      state.params.days +
      " 天 · " +
      state.params.people +
      " 人 · 预算 " +
      money(state.params.budget) +
      " · " +
      esc((state.params.styles || []).join(" / ")) +
      '</p></div><button data-action="open-settings">编辑</button>' +
      "</div>" +
      '<div class="trip-tabs">' +
      tabs
        .map((tab) => {
          return (
            '<button class="trip-tab ' +
            (state.tripTab === tab.id ? "is-active" : "") +
            '" data-action="set-trip-tab" data-id="' +
            tab.id +
            '">' +
            esc(tab.label) +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      '<section class="section">' +
      (state.tripTab === "planner"
        ? renderPlanner()
        : state.tripTab === "saved"
          ? renderSavedHotels()
          : state.tripTab === "compare"
            ? renderCompare()
            : renderTools()) +
      "</section></div>"
    );
  }

  function screenForRoute() {
    if (state.route === "results") return renderResults();
    if (state.route === "destination") return renderDestination();
    if (state.route === "map") return renderRealMap();
    if (state.route === "directory") return renderDirectory();
    if (state.route === "hotel") return renderHotel();
    if (state.route === "rankings") return renderRankingsV2();
    if (state.route === "trip") return renderTrip();
    return renderHome();
  }

  function render() {
    if (leafletMap) {
      leafletMap.remove();
      leafletMap = null;
    }
    if (state.route !== "map" && amapInstance) {
      destroyAmapView(true);
    }
    renderHeader();
    renderBottomNav();
    appMain.dataset.route = state.route;
    appMain.innerHTML = screenForRoute();
    updatePointsResult();
    if (state.route === "map") {
      initAmapMap();
    }
  }

  function openSheet(html) {
    sheet.innerHTML = '<div class="sheet-handle"></div>' + html;
    sheet.hidden = false;
    backdrop.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeSheet() {
    sheet.hidden = true;
    backdrop.hidden = true;
    sheet.innerHTML = "";
    document.body.style.overflow = "";
  }

  function openSettings() {
    openSheet(
      '<div class="sheet-head"><div><h2 id="sheet-title">出行偏好</h2><p>默认条件会保存在本机，用于下一次规划。</p></div>' +
        '<button class="sheet-close" data-action="close-sheet" aria-label="关闭">' +
        icon("close") +
        "</button></div>" +
        '<form id="settings-form">' +
        '<label class="sheet-field"><span>常用出发城市</span><input id="settings-departure" value="' +
        esc(state.params.departure) +
        '" /></label>' +
        '<label class="sheet-field"><span>酒店偏好</span><select id="settings-travel-style">' +
        '<option value="balanced"' +
        (state.params.travelStyle !== "distinctive" ? " selected" : "") +
        ">性价比和质量平衡</option>" +
        '<option value="distinctive"' +
        (state.params.travelStyle === "distinctive" ? " selected" : "") +
        ">别具一格</option>" +
        "</select></label>" +
        '<p class="micro muted" style="margin:-2px 0 12px">别具一格会优先考虑设计酒店、历史建筑、度假目的地和更有当地特色的物业，同时仍尊重你的预算与行程约束。</p>' +
        '<div class="sheet-actions"><button class="btn btn-secondary" type="button" data-action="close-sheet">取消</button><button class="btn btn-primary" type="submit">保存偏好</button></div>' +
        "</form>" +
        '<div class="about-list"><div class="about-item"><strong>数据模式</strong><p>已收录 ' +
        DATA.hotels.length +
        " 家酒店、" +
        DATA.destinations.length +
        " 个城市，并内置 " +
        Object.values(BUNDLED_HOTEL_INSIGHTS.hotels || {}).filter(
          (entry) => Object.keys((entry && entry.facilities) || {}).length
        ).length +
        " 家酒店的房型、设施与公开评论资料。其余酒店可联网获取并保存在本机；没有取得公开报价的酒店显示“查价”，不会伪造价格。</p></div>" +
        '<div class="about-item"><strong>网络与隐私</strong><p>' +
        (KEYLESS_BUILD
          ? "当前为无密钥公开构建：联网查价、地图、美团、飞猪和 DeepSeek 功能未配置。酒店目录、收藏、对比、榜单与本地详情仍可使用。"
          : "网络权限用于美团酒旅景点/餐饮与必吃榜、高德坐标/天气/路线、飞猪酒店与交通、DeepSeek 汇总、官方酒店页面和手动房价更新。收藏、对比、清单、酒店详情与餐饮结果缓存保存在本机；不会登录或读取万豪会员账户。") +
        "</p></div>" +
        '<div class="about-item"><strong>版本</strong><p>旅伴 0.12.1 · 非万豪官方产品 · 目录时间 ' +
        esc(formatDate(DATA.updatedAt)) +
        "</p></div></div>"
    );
  }

  function openOnboarding() {
    openSheet(
      '<div class="sheet-head"><div><h2 id="sheet-title">飞猪联网能力已接入</h2><p>全国目录、实时房价、景点、交通和 AI 行程可以在同一个 App 内协同。</p></div></div>' +
        '<ul class="onboarding-list">' +
        '<li><span class="list-mark">' +
        icon("map") +
        "</span><div><strong>从地图或目录进入</strong><p>按城市、品牌和日期查看酒店；价格标记可直接打开详情。</p></div></li>" +
        '<li><span class="list-mark">' +
        icon("building") +
        "</span><div><strong>" +
        DATA.hotels.length +
        " 家酒店、" +
        DATA.destinations.length +
        " 个城市</strong><p>已覆盖全国主要区域，包括三四线及以下城市中的万豪系物业。直接从万豪官方公开目录同步。</p></div></li>" +
        '<li><span class="list-mark">' +
        icon("spark") +
        "</span><div><strong>飞猪实时查价与行程</strong><p>可查询指定日期的万豪系酒店起价、景点、火车或航班，并生成带核验提醒的逐日建议。高德继续负责地图与驾车路线。</p></div></li>" +
        '<li><span class="list-mark">' +
        icon("source") +
        "</span><div><strong>本地酒店详情与口碑</strong><p>房型、设施和公开评论离线可查；没有评论数据的酒店会明确提示，不生成虚构评价。</p></div></li>" +
        "</ul>" +
        '<button class="btn btn-primary btn-block" data-action="finish-onboarding">进入旅伴</button>'
    );
  }

  function updatePointsResult() {
    const resultEl = document.getElementById("points-result");
    const cashEl = document.getElementById("points-cash-input");
    const pointsEl = document.getElementById("points-points-input");
    if (!resultEl || !cashEl || !pointsEl) return;
    const cash = Math.max(0, Number(cashEl.value) || 0);
    const points = Math.max(0, Number(pointsEl.value) || 0);
    state.calc = { cash, points };
    safeWrite("lvban.calc.v1", state.calc);
    if (!points) {
      resultEl.innerHTML =
        '<div class="calc-value">—</div><div class="calc-label">每万分价值</div><p class="calc-note">输入积分数量后计算。</p>';
      return;
    }
    const perTenK = (cash / points) * 10000;
    let note = "低于 300 元/万分时，现金通常更灵活；仍需结合会员权益判断。";
    if (perTenK >= 500) {
      note = "价值信号较高，可作为兑换候选；请再核对税费、早餐、取消政策和实际可用房型。";
    } else if (perTenK >= 300) {
      note = "处于中性区间，需要结合早餐、酒廊、积分获取成本和个人估值判断。";
    }
    resultEl.innerHTML =
      '<div class="calc-value">' +
      money(perTenK) +
      '</div><div class="calc-label">每万分价值</div><p class="calc-note">' +
      esc(note) +
      "</p>";
  }

  function handleClick(event) {
    const navTarget = event.target.closest("[data-nav]");
    if (navTarget) {
      const nav = navTarget.dataset.nav;
      if (nav === "home") {
        navigate("home", {
          navContext: "home",
          selectedDestinationId: null,
          selectedHotelId: null
        });
      } else {
        navigate(nav, {
          navContext: nav,
          selectedDestinationId: null,
          selectedHotelId: null
        });
      }
      return;
    }

    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;

    if (action === "browse-city") {
      navigate("directory", {
        directoryQuery: target.dataset.query || "",
        directoryRegion: "全国",
        directoryBrand: "all",
        directoryLimit: 24
      });
      return;
    }
    if (action === "quick-search") {
      const input = document.getElementById("query-input");
      if (!input) {
        navigate("home", { navContext: "home" });
        window.setTimeout(() => {
          const newInput = document.getElementById("query-input");
          if (newInput) {
            newInput.value = target.dataset.query || DEFAULT_QUERY;
            const form = document.getElementById("search-form");
            if (form) form.requestSubmit();
          }
        }, 40);
        return;
      }
      input.value = target.dataset.query || DEFAULT_QUERY;
      const form = document.getElementById("search-form");
      if (form) form.requestSubmit();
      return;
    }
    if (action === "toggle-low-walking") {
      state.params.lowWalking = !state.params.lowWalking;
      target.classList.toggle("is-active", state.params.lowWalking);
      target.setAttribute("aria-pressed", String(state.params.lowWalking));
      persistPrefs();
      return;
    }
    if (action === "go-home") {
      navigate("home", {
        navContext: "home",
        selectedDestinationId: null,
        selectedHotelId: null
      });
      return;
    }
    if (action === "home-online-plan") {
      startHomeOnlinePlan();
      return;
    }
    if (action === "go-back") {
      history.back();
      return;
    }
    if (action === "go-rankings") {
      navigate("rankings", { navContext: "rankings" });
      return;
    }
    if (action === "go-map") {
      navigate("map", { navContext: "map" });
      return;
    }
    if (action === "go-directory") {
      navigate("directory", { navContext: "directory" });
      return;
    }
    if (action === "go-trip") {
      navigate("trip", { navContext: "trip" });
      return;
    }
    if (action === "focus-points") {
      state.tripTab = "tools";
      render();
      window.setTimeout(() => {
        const target = document.getElementById("points-tool");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return;
    }
    if (action === "focus-checklist") {
      state.tripTab = "tools";
      render();
      window.setTimeout(() => {
        const target = document.getElementById("checklist-tool");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return;
    }
    if (action === "focus-planner-form") {
      const target = document.getElementById("planner-form-card");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "view-destination") {
      navigate("destination", {
        selectedDestinationId: id,
        selectedHotelId: null,
        navContext: "home"
      });
      return;
    }
    if (action === "view-hotel") {
      const hotel = LOGIC.getHotel(id);
      if (!hotel) return;
      if (state.route === "map" && amapInstance) captureAmapView();
      state.hotelInsightError = "";
      navigate("hotel", {
        selectedHotelId: hotel.id,
        navContext: state.navContext || navKey(state.route)
      });
      return;
    }
    if (action === "load-hotel-insight") {
      state.hotelInsightError = "";
      loadHotelInsight(id, {
        force: target.dataset.force === "true"
      }).catch((error) =>
        showToast(error.message || "酒店详情获取失败")
      );
      return;
    }
    if (action === "open-destination-map") {
      navigate("map", {
        mapCity: id,
        mapBand: "all",
        mapManagement: "all",
        mapBrand: "all",
        mapQuery: "",
        mapAddress: "",
        mapAddressLabel: "",
        mapAddressLocation: null,
        mapAddressLoading: false,
        mapVisible: 16,
        mapSelectedHotelId: null,
        mapZoom: null,
        mapCenter: null,
        mapViewCity: null,
        mapLocationLoading: false,
        navContext: "map"
      });
      return;
    }
    if (action === "locate-map") {
      locateCurrentMapPosition();
      return;
    }
    if (action === "clear-map-address") {
      clearMapAddress();
      return;
    }
    if (action === "open-fliggy-booking") {
      openFliggyBooking(target.dataset.bookingUrl || "");
      return;
    }
    if (action === "set-map-city") {
      state.mapCity = id;
      state.mapSelectedHotelId = null;
      state.mapZoom = null;
      state.mapCenter = null;
      state.mapViewCity = null;
      state.mapBrand = "all";
      state.mapQuery = "";
      state.mapAddress = "";
      state.mapAddressLabel = "";
      state.mapAddressLocation = null;
      state.mapAddressLoading = false;
      state.mapVisible = 16;
      replaceHistorySnapshot();
      render();
      return;
    }
    if (action === "select-map-hotel") {
      state.mapSelectedHotelId = id;
      render();
      return;
    }
    if (action === "set-map-band") {
      state.mapBand = id;
      state.mapSelectedHotelId = null;
      state.mapVisible = 16;
      replaceHistorySnapshot();
      render();
      return;
    }
    if (action === "load-more-map") {
      state.mapVisible += 24;
      render();
      return;
    }
    if (action === "load-more-directory") {
      state.directoryLimit += 30;
      replaceHistorySnapshot();
      render();
      return;
    }
    if (action === "reset-directory-filters") {
      state.directoryQuery = "";
      state.directoryRegion = "全国";
      state.directoryBrand = "all";
      state.directoryLimit = 24;
      replaceHistorySnapshot();
      render();
      return;
    }
    if (action === "reset-map-filters") {
      state.mapBand = "all";
      state.mapManagement = "all";
      state.mapBrand = "all";
      state.mapQuery = "";
      state.mapVisible = 16;
      state.mapSelectedHotelId = null;
      render();
      return;
    }
    if (action === "refresh-city-prices") {
      showToast("已发起官网价格更新");
      requestCityHotelSync(id);
      return;
    }
    if (action === "refresh-flyai-prices") {
      refreshFlyAiCityPrices(id).catch(() => {});
      return;
    }
    if (action === "fill-missing-flyai-prices") {
      fillMissingFlyAiPrices(id).catch(() => {});
      return;
    }
    if (action === "lookup-hotel-price") {
      lookupFlyAiHotelPrice(id)
        .catch((error) => showToast(error.message || "查价失败"));
      return;
    }
    if (action === "refresh-hotel-city") {
      showToast("已发起官网价格更新");
      requestCityHotelSync(id);
      return;
    }
    if (action === "refresh-flyai-hotel-city") {
      refreshFlyAiCityPrices(id).catch(() => {});
      return;
    }
    if (action === "set-rank-mode") {
      state.rankMode = id;
      render();
      return;
    }
    if (action === "set-rank-band") {
      state.rankBand = id;
      state.rankLimit = 20;
      state.rankExpandedId = null;
      replaceHistorySnapshot();
      render();
      return;
    }
    if (action === "set-rank-season") {
      state.rankSeason = id;
      state.rankLimit = 20;
      state.rankExpandedId = null;
      replaceHistorySnapshot();
      render();
      return;
    }
    if (action === "set-rank-sort") {
      state.rankSort = id;
      state.rankLimit = 20;
      replaceHistorySnapshot();
      render();
      return;
    }
    if (action === "toggle-rank-ledger") {
      state.rankExpandedId = state.rankExpandedId === id ? null : id;
      render();
      return;
    }
    if (action === "more-rank-results") {
      state.rankLimit += 20;
      render();
      return;
    }
    if (action === "toggle-value-settings") {
      state.rankSettingsOpen = !state.rankSettingsOpen;
      render();
      return;
    }
    if (action === "set-value-tier") {
      valuePrefs.tier = id;
      safeWrite("lvban.valuePrefs.v1", valuePrefs);
      render();
      return;
    }
    if (action === "set-rank-region") {
      state.rankRegion = id;
      render();
      return;
    }
    if (action === "set-rank-brand") {
      state.rankBrand = id;
      render();
      return;
    }
    if (action === "reset-rank-filters") {
      state.rankBand = "all";
      state.rankBrand = "all";
      state.rankRegion = "全国";
      state.rankScope = "all";
      state.rankSeason = "all";
      state.rankLimit = 20;
      state.rankExpandedId = null;
      replaceHistorySnapshot();
      render();
      return;
    }
    if (action === "set-trip-tab") {
      state.tripTab = id;
      render();
      return;
    }
    if (action === "toggle-favorite") {
      if (!id) return;
      if (favorites.has(id)) {
        favorites.delete(id);
        showToast("已取消收藏");
      } else {
        favorites.add(id);
        showToast("已加入收藏");
      }
      persistFavorites();
      const scrollY = window.scrollY;
      render();
      window.scrollTo(0, scrollY);
      return;
    }
    if (action === "toggle-compare") {
      if (!id) return;
      if (comparisons.has(id)) {
        comparisons.delete(id);
        showToast("已移出对比");
      } else if (comparisons.size >= 4) {
        showToast("最多同时对比 4 家酒店");
        return;
      } else {
        comparisons.add(id);
        showToast("已加入对比");
      }
      persistComparisons();
      const scrollY = window.scrollY;
      render();
      window.scrollTo(0, scrollY);
      return;
    }
    if (action === "remove-compare") {
      comparisons.delete(id);
      persistComparisons();
      render();
      return;
    }
    if (action === "clear-compare") {
      comparisons.clear();
      persistComparisons();
      render();
      showToast("对比列表已清空");
      return;
    }
    if (action === "open-settings") {
      openSettings();
      return;
    }
    if (action === "close-sheet") {
      closeSheet();
      return;
    }
    if (action === "finish-onboarding") {
      onboardingDismissed = true;
      safeWrite("lvban.onboarding.v1", true);
      closeSheet();
      return;
    }
  }

  function handleSubmit(event) {
    if (event.target.id === "home-directory-search") {
      event.preventDefault();
      navigate("directory", {
        directoryQuery: document.getElementById("home-directory-query").value.trim(),
        directoryRegion: "全国",
        directoryBrand: "all",
        directoryLimit: 24
      });
      return;
    }
    if (event.target.id === "search-form") {
      event.preventDefault();
      if (document.getElementById("destination-input").value.trim()) {
        startHomeOnlinePlan();
      } else {
        readSearchForm();
      }
      return;
    }
    if (event.target.id === "settings-form") {
      event.preventDefault();
      const departure = document.getElementById("settings-departure").value.trim() || "上海";
      const travelStyle =
        document.getElementById("settings-travel-style").value === "distinctive"
          ? "distinctive"
          : "balanced";
      state.params.departure = departure;
      state.params.travelStyle = travelStyle;
      state.plannerDraft = Object.assign({}, state.plannerDraft || {}, {
        travelStyle
      });
      safeWrite("lvban.plannerDraft.v1", state.plannerDraft);
      persistPrefs();
      closeSheet();
      render();
      showToast("出行偏好已保存在本机");
      return;
    }
    if (event.target.id === "map-search-form") {
      event.preventDefault();
      state.mapQuery = document.getElementById("map-query-input").value.trim();
      state.mapSelectedHotelId = null;
      state.mapVisible = 16;
      replaceHistorySnapshot();
      render();
      return;
    }
    if (event.target.id === "map-address-form") {
      event.preventDefault();
      searchMapAddress();
      return;
    }
    if (event.target.id === "directory-search-form") {
      event.preventDefault();
      state.directoryQuery = document
        .getElementById("directory-query-input")
        .value.trim();
      state.directoryLimit = 24;
      replaceHistorySnapshot();
      render();
      return;
    }
    if (event.target.id === "planner-form") {
      event.preventDefault();
      runTripPlanner(plannerDraftFromForm());
    }
  }

  function handleChange(event) {
    if (event.target.id === "trip-hotel-select") {
      updateTripPlanHotel(event.target.value);
      return;
    }
    if (event.target.id === "directory-region") {
      state.directoryRegion = event.target.value;
      state.directoryLimit = 24;
      replaceHistorySnapshot();
      render();
      return;
    }
    if (event.target.id === "directory-brand") {
      state.directoryBrand = event.target.value;
      state.directoryLimit = 24;
      replaceHistorySnapshot();
      render();
      return;
    }
    if (event.target.id === "rank-scope" || event.target.id === "rank-brand") {
      state[event.target.id === "rank-scope" ? "rankScope" : "rankBrand"] =
        event.target.value || "all";
      state.rankLimit = 20;
      state.rankExpandedId = null;
      replaceHistorySnapshot();
      render();
      return;
    }
    if (event.target.id === "value-point-value" || event.target.id === "value-discount") {
      const key = event.target.id === "value-point-value" ? "pointValue" : "discountPct";
      const max = key === "pointValue" ? 2000 : 60;
      const number = Number(event.target.value);
      valuePrefs[key] = Number.isFinite(number)
        ? Math.min(max, Math.max(0, number))
        : LOGIC.VALUE_DEFAULTS[key];
      safeWrite("lvban.valuePrefs.v1", valuePrefs);
      render();
      return;
    }
    if (event.target.id === "map-city-select") {
      state.mapCity = event.target.value;
      state.mapZoom = null;
      state.mapCenter = null;
      state.mapViewCity = null;
      state.mapLocationLoading = false;
      state.mapManagement = "all";
      state.mapBrand = "all";
      state.mapBand = "all";
      state.mapQuery = "";
      state.mapAddress = "";
      state.mapAddressLabel = "";
      state.mapAddressLocation = null;
      state.mapAddressLoading = false;
      state.mapVisible = 16;
      state.mapSelectedHotelId = null;
      state.sync = { status: "idle", message: "", updatedAt: state.sync.updatedAt };
      state.flyAi = { status: "idle", message: "", updatedAt: state.flyAi.updatedAt };
      replaceHistorySnapshot();
      render();
      return;
    }
    if (event.target.id === "map-checkin") {
      state.mapCheckIn = event.target.value || defaultTravelDate(1);
      state.flyAi = {
        status: "idle",
        message: "",
        updatedAt: state.flyAi.updatedAt
      };
      safeWrite("lvban.mapCheckIn.v1", state.mapCheckIn);
      replaceHistorySnapshot();
      return;
    }
    if (event.target.id === "map-brand") {
      state.mapBrand = event.target.value;
      state.mapSelectedHotelId = null;
      state.mapVisible = 16;
      replaceHistorySnapshot();
      render();
      return;
    }
    if (event.target.id === "map-management") {
      state.mapManagement = event.target.value;
      state.mapSelectedHotelId = null;
      state.mapVisible = 16;
      render();
      return;
    }
    if (event.target.matches("[data-check]")) {
      checklist[event.target.dataset.check] = event.target.checked;
      persistChecklist();
      const scrollY = window.scrollY;
      render();
      window.scrollTo(0, scrollY);
      return;
    }
  }

  function handleInput(event) {
    if (
      event.target.id === "points-cash-input" ||
      event.target.id === "points-points-input"
    ) {
      updatePointsResult();
    }
  }

  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("change", handleChange);
  document.addEventListener("input", handleInput);
  document.addEventListener("error", (event) => {
    if (event.target.matches && event.target.matches("img[data-hotel-photo]")) {
      event.target.hidden = true;
      event.target.parentElement.classList.add("image-unavailable");
    }
  }, true);
  backdrop.addEventListener("click", closeSheet);
  window.addEventListener("popstate", (event) => {
    closeSheet();
    restoreHistory(event.state);
  });

  window.setTimeout(updatePointsResult, 0);
  if (window.history && history.replaceState) {
    history.replaceState(historySnapshot(), "");
  }
  render();
  if (!onboardingDismissed) {
    window.setTimeout(openOnboarding, 420);
  }
})();
