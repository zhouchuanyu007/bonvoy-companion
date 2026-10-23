(function (global) {
  "use strict";

  const DATA = global.APP_DATA;

  const THEMES = {
    positive: [
      { id: "location", label: "位置与交通", pattern: /位置|交通|地铁|方便|步行/ },
      { id: "breakfast", label: "早餐", pattern: /早餐|自助|餐饮/ },
      { id: "service", label: "服务", pattern: /服务|热情|响应|前台/ },
      { id: "room", label: "房间舒适度", pattern: /房间|床|视野|景观|采光/ },
      { id: "clean", label: "清洁", pattern: /干净|整洁|卫生好/ },
      { id: "lounge", label: "酒廊", pattern: /酒廊|行政待遇|欢乐时光/ },
      { id: "upgrade", label: "会员体验", pattern: /升级|会员|礼遇/ }
    ],
    issue: [
      { id: "noise", label: "噪音与隔音", pattern: /噪音|隔音|吵|临街|电梯|施工/ },
      { id: "air", label: "空调与通风", pattern: /空调|通风|闷|温度/ },
      { id: "cleanIssue", label: "卫生与异味", pattern: /异味|烟味|潮味|不干净|卫生|霉|虫/ },
      { id: "old", label: "设施老化", pattern: /旧|老化|破损|翻新|装修/ },
      { id: "queue", label: "排队与效率", pattern: /排队|很慢|等了|效率|办理/ },
      { id: "benefit", label: "权益执行", pattern: /不给|未兑现|酒廊关闭|早餐没有|待遇/ },
      { id: "parking", label: "停车与交通", pattern: /停车|堵车|难打车|接驳/ }
    ]
  };

  function getDestination(id) {
    return DATA.destinations.find((item) => item.id === id) || null;
  }

  function getHotel(id) {
    return DATA.hotels.find((item) => item.id === id) || null;
  }

  function hotelsFor(destinationId) {
    return DATA.hotels.filter((item) => item.destinationId === destinationId);
  }

  function formatMoney(value) {
    if (!Number.isFinite(Number(value))) return "待查价";
    return "¥" + Math.round(value).toLocaleString("zh-CN");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function knownRoute(destination, origin) {
    if (destination.routes && destination.routes[origin]) {
      return destination.routes[origin];
    }
    return {
      mode: "跨城交通待核验",
      time: "时间待核验",
      cost: 750,
      estimated: true
    };
  }

  function nightlyRateFor(hotel) {
    if (Number.isFinite(Number(hotel.price)) && Number(hotel.price) > 0) {
      return {
        amount: Number(hotel.price),
        known: true,
        source: "官方公开报价快照"
      };
    }
    const tierEstimate = {
      奢华: 1500,
      高端: 900,
      精选: 500
    };
    return {
      amount: tierEstimate[hotel.brandTier] || 700,
      known: false,
      source: "品牌档次预算估算"
    };
  }

  function calculateTripCost(destination, hotel, params) {
    const days = clamp(Number(params.days) || 3, 1, 10);
    const people = clamp(Number(params.people) || 2, 1, 8);
    const rooms = clamp(Number(params.rooms) || 1, 1, 4);
    const nights = Math.max(1, days - 1);
    const route = knownRoute(destination, params.departure || "上海");
    const transport = route.cost * people;
    const nightly = nightlyRateFor(hotel);
    const lodging = nightly.amount * nights * rooms;
    const food = destination.foodPerDay * people * days;
    const local = destination.localPerDay * people * days;
    const tickets = destination.ticketPerPerson * people;
    const total = transport + lodging + food + local + tickets;

    return {
      days,
      nights,
      people,
      rooms,
      route,
      nightlyRate: nightly.amount,
      priceKnown: nightly.known,
      priceEstimateSource: nightly.source,
      transport,
      lodging,
      food,
      local,
      tickets,
      total,
      budget: Number(params.budget) || 0,
      difference: (Number(params.budget) || 0) - total
    };
  }

  function budgetFit(total, budget) {
    if (!budget) return 0.8;
    const ratio = total / budget;
    if (ratio <= 0.8) return 1;
    if (ratio <= 1) return 0.92;
    if (ratio <= 1.15) return 0.65;
    if (ratio <= 1.35) return 0.4;
    return 0.2;
  }

  function pickHotelForTrip(destination, params) {
    const hotels = hotelsFor(destination.id);
    const scored = hotels
      .map((hotel) => {
        const cost = calculateTripCost(destination, hotel, params);
        const fit = budgetFit(cost.total, params.budget);
        const pricePenalty = cost.priceKnown ? 0 : 4;
        const distance = Number(hotel.distanceFromCenterKm);
        const distancePenalty = Number.isFinite(distance)
          ? Math.min(18, Math.max(0, distance - 8) / 3)
          : 0;
        const walkBoost =
          params.lowWalking && destination.walkLevel === "high" ? -10 : 0;
        return {
          hotel,
          cost,
          score:
            hotel.quality * 7 +
            fit * 30 +
            walkBoost -
            pricePenalty -
            distancePenalty
        };
      })
      .sort((a, b) => b.score - a.score);
    return scored[0] || null;
  }

  function seasonStatus(destination, month) {
    if (destination.seasonMonths.includes(month)) {
      return {
        level: "best",
        label: "正当时",
        score: 1
      };
    }
    if (destination.shoulderMonths.includes(month)) {
      return {
        level: "shoulder",
        label: "临近窗口",
        score: 0.55
      };
    }
    return {
      level: "off",
      label: "非最佳窗口",
      score: 0.2
    };
  }

  function getManagementCounts(destinationId) {
    const hotels = destinationId
      ? hotelsFor(destinationId)
      : DATA.hotels.slice();
    const counts = {};
    Object.keys(DATA.managementModes).forEach((key) => {
      counts[key] = 0;
    });
    hotels.forEach((hotel) => {
      counts[hotel.mode] = (counts[hotel.mode] || 0) + 1;
    });
    return counts;
  }

  function managementSummary(destinationId) {
    const counts = getManagementCounts(destinationId);
    return Object.keys(counts)
      .filter((key) => counts[key] > 0)
      .map((key) => DATA.managementModes[key] + " " + counts[key])
      .join(" · ");
  }

  function parseQuery(text, defaults) {
    const result = Object.assign(
      {
        query: text || "",
        departure: "上海",
        month: 11,
        days: 3,
        people: 2,
        rooms: 1,
        budget: 5000,
        styles: [],
        lowWalking: false
      },
      defaults || {}
    );
    const source = text || "";

    const stylePatterns = [
      { label: "赏秋", pattern: /赏秋|秋色|红叶|银杏|秋天/ },
      { label: "温泉", pattern: /温泉|泡汤/ },
      { label: "亲子", pattern: /亲子|孩子|儿童|带娃/ },
      { label: "美食", pattern: /美食|好吃|吃饭|餐厅/ },
      { label: "自然", pattern: /自然|山林|湖|湿地|竹海/ },
      { label: "城市漫游", pattern: /城市漫游|城市|逛街|博物馆/ }
    ];
    stylePatterns.forEach((item) => {
      if (item.pattern.test(source) && !result.styles.includes(item.label)) {
        result.styles.push(item.label);
      }
    });

    const monthMatch = source.match(/(1[0-2]|[1-9])\s*月/);
    if (monthMatch) {
      result.month = Number(monthMatch[1]);
    }
    const daysMatch = source.match(/([2-7])\s*天/);
    if (daysMatch) {
      result.days = Number(daysMatch[1]);
    }
    const peopleMatch = source.match(/([1-6])\s*人/);
    if (peopleMatch) {
      result.people = Number(peopleMatch[1]);
    }
    const budgetMatch =
      source.match(/预算\s*[¥￥]?\s*(\d{3,6})/) ||
      source.match(/[¥￥]\s*(\d{3,6})/) ||
      source.match(/(\d{3,6})\s*元/);
    if (budgetMatch) {
      result.budget = Number(budgetMatch[1]);
    }
    const origins = ["上海", "北京", "杭州", "南京", "广州", "深圳", "成都"];
    const detectedOrigin = origins.find((city) => source.includes(city + "出发"));
    if (detectedOrigin) {
      result.departure = detectedOrigin;
    }
    result.lowWalking = /少走路|轻松|不赶路|慢慢走|低强度/.test(source);
    return result;
  }

  function recommendationReasons(destination, hotel, cost, season) {
    const reasons = [];
    if (season.level === "best") {
      reasons.push(destination.bestWindow + "处于赏秋主窗口");
    } else if (season.level === "shoulder") {
      reasons.push("已接近赏秋窗口，适合错峰");
    }
    if (cost.route.time && !/待核验/.test(cost.route.time)) {
      reasons.push(cost.route.mode + " " + cost.route.time);
    }
    if (cost.difference >= 0) {
      reasons.push("预计预算内，余量 " + formatMoney(cost.difference));
    } else {
      reasons.push("估算超出预算 " + formatMoney(Math.abs(cost.difference)));
    }
    if (hotel) {
      reasons.push("推荐酒店 " + hotel.name);
    }
    return reasons.slice(0, 3);
  }

  function recommendDestinations(params) {
    const styles = params.styles && params.styles.length ? params.styles : ["赏秋"];
    return DATA.destinations
      .filter((destination) => hotelsFor(destination.id).length > 0)
      .map((destination) => {
        const picked = pickHotelForTrip(destination, params);
        const season = seasonStatus(destination, Number(params.month));
        const themeMatches = destination.tags.filter((tag) => styles.includes(tag)).length;
        const themeScore = clamp(themeMatches / styles.length, 0, 1);
        const cost = picked
          ? picked.cost
          : {
              total: 0,
              difference: params.budget || 0,
              route: knownRoute(destination, params.departure)
            };
        const fit = budgetFit(cost.total, Number(params.budget) || 0);
        const access = /待核验/.test(cost.route.time) ? 0.45 : 0.9;
        const walk =
          params.lowWalking && destination.walkLevel === "high"
            ? -0.15
            : params.lowWalking && destination.walkLevel === "medium"
              ? -0.05
              : 0;
        const hotelQuality = picked ? picked.hotel.quality / 10 : 0.6;
        const raw =
          themeScore * 0.3 +
          season.score * 0.24 +
          fit * 0.2 +
          hotelQuality * 0.16 +
          access * 0.1 +
          walk;
        const match = Math.round(clamp(50 + raw * 48, 55, 98));
        return {
          destination,
          hotel: picked ? picked.hotel : null,
          cost,
          season,
          match,
          reasons: recommendationReasons(
            destination,
            picked ? picked.hotel : null,
            cost,
            season
          )
        };
      })
      .sort((a, b) => b.match - a.match)
      .slice(0, 3);
  }

  function valueIndex(hotel) {
    if (!Number.isFinite(Number(hotel.price)) || Number(hotel.price) <= 0) return 0;
    return (hotel.quality * 1000) / hotel.price;
  }

  function getRankedHotels(options) {
    const mode = options.mode || "quality";
    const bandId = options.band || "all";
    const brand = options.brand || "all";
    const region = options.region || "全国";
    const band = DATA.priceBands.find((item) => item.id === bandId) || DATA.priceBands[0];
    const filtered = DATA.hotels.filter((hotel) => {
      const hasPrice = Number.isFinite(Number(hotel.price)) && Number(hotel.price) > 0;
      const inBand =
        bandId === "all" ? true : hasPrice && hotel.price >= band.min && hotel.price <= band.max;
      const inBrand = brand === "all" || hotel.brand === brand;
      const hotelRegion =
        hotel.region ||
        (getDestination(hotel.destinationId) && getDestination(hotel.destinationId).region);
      const inRegion = region === "全国" || hotelRegion === region;
      const valueEligible = mode !== "value" || hasPrice;
      return inBand && inBrand && inRegion && valueEligible;
    });
    const maxValue = Math.max(...filtered.map(valueIndex), 0.01);
    return filtered
      .slice()
      .sort((a, b) => {
        if (mode === "value") {
          return valueIndex(b) - valueIndex(a);
        }
        return b.quality - a.quality || (a.price || 99999) - (b.price || 99999);
      })
      .slice(0, 10)
      .map((hotel, index) => ({
        hotel,
        destination: getDestination(hotel.destinationId),
        rank: index + 1,
        displayScore:
          mode === "value"
            ? Math.round((valueIndex(hotel) / maxValue) * 100) / 10
            : hotel.quality,
        index: valueIndex(hotel)
      }));
  }

  // ---------------------------------------------------------------------------
  // Happiness value ranking: what one night really costs after discounts and
  // points, set against how good the stay is likely to feel.
  // ---------------------------------------------------------------------------

  const VALUE_DEFAULTS = {
    pointValue: 400, // CNY per 10,000 Marriott Bonvoy points
    tier: "member",
    discountPct: 0
  };

  // Marriott Bonvoy Terms 2.1.a / 5.3.b: base earn per USD and elite bonus.
  const ELITE_TIERS = [
    { id: "member", label: "会员", bonus: 0 },
    { id: "silver", label: "银卡", bonus: 0.1 },
    { id: "gold", label: "金卡", bonus: 0.25 },
    { id: "platinum", label: "白金", bonus: 0.5 },
    { id: "titanium", label: "钛金+", bonus: 0.75 }
  ];
  const REDUCED_EARN_BRANDS = new Set(["EL", "ER", "BA", "RI", "TS"]);
  const USD_CNY = 7.1;
  // Fixed estimates; official quotes for HK/Macau/Taiwan are in local currency.
  const CNY_PER_UNIT = { CNY: 1, USD: USD_CNY, HKD: 0.91, MOP: 0.88, TWD: 0.22 };
  const REGION_CURRENCY = [
    ["香港", "HKD"],
    ["澳门", "MOP"],
    ["台湾", "TWD"]
  ];

  function localCurrency(hotel) {
    const place = String((hotel && (hotel.provinceFull || hotel.province || hotel.cityFull || hotel.city)) || "");
    const match = REGION_CURRENCY.find(([name]) => place.includes(name));
    return match ? match[1] : "CNY";
  }

  // Returns the CNY rate for an amount, or null for an unknown currency.
  function cnyRate(currency, hotel) {
    const code = String(currency || localCurrency(hotel)).toUpperCase();
    return Object.prototype.hasOwnProperty.call(CNY_PER_UNIT, code) ? CNY_PER_UNIT[code] : null;
  }
  const ASSUMED_TAX_RATE = 0.166;

  const HAPPINESS_WEIGHTS = { rating: 45, view: 20, breakfast: 20, gym: 15 };
  const VIEW_SCORES = {
    海景: 1,
    湖景: 1,
    江景: 0.9,
    雪山景: 0.9,
    河景: 0.75,
    山景: 0.75,
    地标景: 0.7,
    园景: 0.5,
    泳池景: 0.45,
    城景: 0.3
  };
  const UNKNOWN_SIGNAL = 0.4;

  const SEASONS = [
    { id: "spring", label: "春", months: [3, 4, 5] },
    { id: "summer", label: "夏", months: [6, 7, 8] },
    { id: "autumn", label: "秋", months: [9, 10, 11] },
    { id: "winter", label: "冬", months: [12, 1, 2] }
  ];
  const COOL_SUMMER_PROVINCES = new Set([
    "云南", "贵州", "黑龙江", "吉林", "新疆", "青海", "甘肃", "西藏", "内蒙古"
  ]);
  const WARM_WINTER_PROVINCES = new Set(["海南"]);
  const MILD_WINTER_PROVINCES = new Set(["云南", "广东", "广西", "福建"]);

  function valueSignalsFor(hotel) {
    const store = global.APP_VALUE_SIGNALS;
    return (store && store.hotels && store.hotels[hotel.id]) || null;
  }

  function bonusPointsFor(hotel) {
    const live = hotel && hotel.pointsPromotion;
    const bundled =
      global.APP_POINTS_PROMOTIONS &&
      global.APP_POINTS_PROMOTIONS.hotels &&
      global.APP_POINTS_PROMOTIONS.hotels[hotel.id];
    const promotion = live || bundled;
    const points = Number(promotion && promotion.bonusPoints);
    return Number.isFinite(points) && points > 0 ? points : 0;
  }

  // Standard redemption (points per night) captured from the official search
  // on the same night as its cash total, so the two are directly comparable.
  function awardRedemption(hotel, prefs) {
    const store = global.APP_AWARD_POINTS;
    const record = store && store.hotels && store.hotels[hotel.id];
    const points = Number(record && record.points);
    if (!Number.isFinite(points) || points <= 0) return null;
    const settings = normalizeValuePrefs(prefs);
    const sameNightCash = Number(record.cashTotal);
    const currency = String(record.currency || localCurrency(hotel)).toUpperCase();
    const rate = cnyRate(currency, hotel);
    const cash = Number.isFinite(sameNightCash) && sameNightCash > 0 && rate ? sameNightCash * rate : null;
    // A same-night cash quote far above the catalog price usually means only a
    // premium room was left; that would overstate the redemption value.
    const catalogRate = cnyRate(hotel.priceMeta && hotel.priceMeta.currency, hotel);
    const catalogCash = Number(hotel.totalPrice || hotel.price) * (catalogRate || 0);
    const suspect = Boolean(cash && catalogCash > 0 && cash > catalogCash * 3);
    const valuePer10k = cash && !suspect ? (cash / points) * 10000 : null;
    return {
      points,
      cash,
      suspect,
      cashLocal: Number.isFinite(sameNightCash) && sameNightCash > 0 ? sameNightCash : null,
      currency,
      available: record.available !== false,
      checkIn: store.checkIn || "",
      valuePer10k,
      // Ratio against the user's own valuation; >1 means points beat cash.
      versusPrefs: valuePer10k && settings.pointValue > 0 ? valuePer10k / settings.pointValue : null,
      pointsCostAtPrefs: (points / 10000) * settings.pointValue
    };
  }

  function normalizeValuePrefs(prefs) {
    const merged = Object.assign({}, VALUE_DEFAULTS, prefs || {});
    const pointValue = Number(merged.pointValue);
    const discountPct = Number(merged.discountPct);
    return {
      pointValue: Number.isFinite(pointValue) ? clamp(pointValue, 0, 2000) : 400,
      tier: ELITE_TIERS.some((tier) => tier.id === merged.tier) ? merged.tier : "member",
      discountPct: Number.isFinite(discountPct) ? clamp(discountPct, 0, 60) : 0
    };
  }

  // Returns null when the hotel has no usable public price. `resolveBonus`
  // lets the app supply live flash-promo points it already knows about.
  function netCostBreakdown(hotel, prefs, resolveBonus) {
    const settings = normalizeValuePrefs(prefs);
    const currency = String((hotel.priceMeta && hotel.priceMeta.currency) || "CNY").toUpperCase();
    const rate = cnyRate(currency, hotel);
    if (!rate) return null;
    const price = Number(hotel.price) * rate;
    if (!Number.isFinite(price) || price <= 0) return null;
    const total = Number(hotel.totalPrice) * rate;
    const taxIncluded = Number.isFinite(total) && total > 0;
    // Marriott quotes carry a pre-tax price plus a tax-inclusive total; other
    // sources (Fliggy) quote a single tax-inclusive price.
    const cost = taxIncluded ? total : price;
    const preTax = taxIncluded ? price : price / (1 + ASSUMED_TAX_RATE);
    const discount = (cost * settings.discountPct) / 100;
    const tier = ELITE_TIERS.find((item) => item.id === settings.tier);
    const basePerUsd = REDUCED_EARN_BRANDS.has(hotel.brandId) ? 5 : 10;
    const earnedPoints = Math.round(
      ((preTax * (1 - settings.discountPct / 100)) / USD_CNY) *
        basePerUsd *
        (1 + tier.bonus)
    );
    const earnedValue = (earnedPoints / 10000) * settings.pointValue;
    const resolved = typeof resolveBonus === "function" ? Number(resolveBonus(hotel)) : 0;
    const bonusPoints = Number.isFinite(resolved) && resolved > 0 ? resolved : bonusPointsFor(hotel);
    const bonusValue = (bonusPoints / 10000) * settings.pointValue;
    const netCost = Math.max(1, cost - discount - earnedValue - bonusValue);
    return {
      cost,
      taxIncluded,
      discount,
      earnedPoints,
      earnedValue,
      bonusPoints,
      bonusValue,
      netCost,
      currency,
      fxRate: rate,
      basePerUsd,
      tierLabel: tier.label,
      discountPct: settings.discountPct,
      pointValue: settings.pointValue
    };
  }

  function breakfastScore(breakfast) {
    if (!breakfast) return { score: UNKNOWN_SIGNAL, label: "早餐待核实", known: false };
    if (breakfast.type === "none") return { score: 0, label: "不提供早餐", known: true };
    if (breakfast.type === "buffet") {
      const cuisines = clamp(breakfast.cuisines || 1, 1, 4);
      const priceBoost = breakfast.price >= 200 ? 0.15 : breakfast.price >= 120 ? 0.08 : 0;
      return {
        score: clamp(0.55 + cuisines * 0.075 + priceBoost, 0, 1),
        label: "自助早餐" + (cuisines > 1 ? " · " + cuisines + " 类菜系" : ""),
        known: true
      };
    }
    if (breakfast.type === "set") return { score: 0.4, label: "套餐早餐", known: true };
    if (breakfast.type === "alacarte") return { score: 0.35, label: "单点早餐", known: true };
    return { score: 0.35, label: "早餐形式未注明", known: true };
  }

  function happinessBreakdown(hotel) {
    const signal = valueSignalsFor(hotel);
    const quality = Number(hotel.quality);
    const ratingScore = Number.isFinite(quality) ? clamp((quality - 7) / 2.6, 0, 1) : 0;
    const view = signal && signal.view ? signal.view : "";
    const viewScore = view ? VIEW_SCORES[view] || 0.3 : UNKNOWN_SIGNAL;
    const breakfast = breakfastScore(signal && signal.breakfast);
    const gymKnown = Boolean(signal);
    const gymScore = gymKnown ? (signal.gym ? 1 : 0) : UNKNOWN_SIGNAL;
    const parts = [
      {
        id: "rating",
        label: "酒店评分",
        detail: Number.isFinite(quality) ? quality.toFixed(1) + " / 10" : "暂无评分",
        score: ratingScore,
        weight: HAPPINESS_WEIGHTS.rating,
        known: Number.isFinite(quality)
      },
      {
        id: "view",
        label: "风景",
        detail: view ? view + (signal.viewInName ? "房型" : "") : "景观待核实",
        score: viewScore,
        weight: HAPPINESS_WEIGHTS.view,
        known: Boolean(view)
      },
      {
        id: "breakfast",
        label: "早餐丰盛度",
        detail: breakfast.label,
        score: breakfast.score,
        weight: HAPPINESS_WEIGHTS.breakfast,
        known: breakfast.known
      },
      {
        id: "gym",
        label: "健身房",
        detail: gymKnown ? (signal.gym ? "有健身房" : "未列出健身房") : "设施待核实",
        score: gymScore,
        weight: HAPPINESS_WEIGHTS.gym,
        known: gymKnown
      }
    ];
    parts.forEach((part) => {
      part.points = Math.round(part.score * part.weight * 10) / 10;
    });
    const total = parts.reduce((sum, part) => sum + part.score * part.weight, 0);
    return {
      score: Math.round(total * 10) / 10,
      parts,
      complete: parts.every((part) => part.known),
      signal
    };
  }

  function seasonForMonth(month) {
    return SEASONS.find((season) => season.months.includes(Number(month))) || SEASONS[0];
  }

  function provinceKey(hotel) {
    return cleanProvince(hotel.province || "");
  }

  function cleanProvince(value) {
    return String(value).replace(/壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区|省|市/g, "");
  }

  // Seasonal fit in [0, 1] with a short reason; 0 means not a seasonal pick.
  function seasonFit(hotel, seasonId, month) {
    const season = SEASONS.find((item) => item.id === seasonId);
    if (!season) return { score: 0, reason: "" };
    const signal = valueSignalsFor(hotel) || {};
    const features = new Set(signal.features || []);
    const province = provinceKey(hotel);
    const destination = getDestination(hotel.destinationId);
    const seasonMonths = (destination && destination.seasonMonths) || [];
    const inDestinationSeason = season.months.some((item) =>
      seasonMonths.includes(item)
    );
    const candidates = [];
    if (inDestinationSeason && destination.seasonLabel) {
      candidates.push({ score: 1, reason: destination.seasonLabel });
    }
    if (season.id === "winter") {
      if (features.has("spring")) candidates.push({ score: 1, reason: "冬季泡温泉" });
      if (features.has("ski")) candidates.push({ score: 1, reason: "雪季近滑雪场" });
      if (WARM_WINTER_PROVINCES.has(province)) {
        candidates.push({ score: 1, reason: "冬季避寒" });
      } else if (MILD_WINTER_PROVINCES.has(province) && features.has("beach")) {
        candidates.push({ score: 0.65, reason: "南方暖冬海景" });
      } else if (province === "云南") {
        candidates.push({ score: 0.6, reason: "春城暖冬" });
      }
    } else if (season.id === "summer") {
      if (features.has("beach")) candidates.push({ score: 1, reason: "夏季海滨" });
      if (COOL_SUMMER_PROVINCES.has(province)) {
        candidates.push({ score: 0.9, reason: "夏季避暑" });
      }
      if (features.has("mountain") || features.has("lake")) {
        candidates.push({ score: 0.6, reason: "山湖消暑" });
      }
    } else if (season.id === "autumn") {
      if (features.has("mountain") || features.has("lake")) {
        candidates.push({ score: 0.75, reason: "秋季山湖景观" });
      }
      if (["新疆", "内蒙古", "甘肃", "四川", "吉林"].includes(province)) {
        candidates.push({ score: 0.6, reason: "秋色正当季" });
      }
      if (features.has("spring") && Number(month) === 11) {
        candidates.push({ score: 0.6, reason: "深秋温泉" });
      }
    } else if (season.id === "spring") {
      if (features.has("lake") || signal.view === "园景") {
        candidates.push({ score: 0.7, reason: "春季湖景园林" });
      }
      if (["浙江", "江苏", "云南"].includes(province)) {
        candidates.push({ score: 0.5, reason: "春季出游舒适" });
      }
    }
    return candidates.sort((a, b) => b.score - a.score)[0] || { score: 0, reason: "" };
  }

  function matchesScope(hotel, scope) {
    if (!scope || scope === "all") return true;
    if (scope.startsWith("region:")) return hotel.region === scope.slice(7);
    if (scope.startsWith("city:")) return hotel.city === scope.slice(5);
    return true;
  }

  function evaluateHotelValue(hotel, options) {
    const cost = netCostBreakdown(hotel, options.prefs, options.bonusPointsFor);
    if (!cost) return null;
    const happiness = happinessBreakdown(hotel);
    const season = options.season && options.season !== "all"
      ? seasonFit(hotel, options.season, options.month)
      : { score: 0, reason: "" };
    const seasonBonus = Math.round(season.score * 12 * 10) / 10;
    const happinessScore = Math.min(100, happiness.score + seasonBonus);
    return {
      hotel,
      destination: getDestination(hotel.destinationId),
      cost,
      happiness,
      season,
      seasonBonus,
      happinessScore,
      award: awardRedemption(hotel, options.prefs),
      // Happiness points bought per 1,000 CNY of real nightly cost.
      valuePerThousand: (happinessScore / cost.netCost) * 1000
    };
  }

  function getHappinessRanking(options) {
    const settings = Object.assign(
      { scope: "all", band: "all", brand: "all", season: "all", sort: "value", limit: 20 },
      options || {}
    );
    const band =
      DATA.priceBands.find((item) => item.id === settings.band) || DATA.priceBands[0];
    let unrated = 0;
    let unpriced = 0;
    const pool = [];
    DATA.hotels.forEach((hotel) => {
      if (!matchesScope(hotel, settings.scope)) return;
      if (settings.brand !== "all" && hotel.brand !== settings.brand) return;
      if (!Number.isFinite(Number(hotel.quality))) {
        unrated += 1;
        return;
      }
      const item = evaluateHotelValue(hotel, settings);
      if (!item) {
        unpriced += 1;
        return;
      }
      if (settings.season !== "all" && item.season.score <= 0) return;
      if (
        settings.band !== "all" &&
        (item.cost.netCost < band.min || item.cost.netCost > band.max)
      ) {
        return;
      }
      pool.push(item);
    });
    const sorters = {
      value: (a, b) => b.valuePerThousand - a.valuePerThousand,
      happiness: (a, b) =>
        b.happinessScore - a.happinessScore || a.cost.netCost - b.cost.netCost,
      cost: (a, b) => a.cost.netCost - b.cost.netCost || b.happinessScore - a.happinessScore
      ,
      // Best redemption value first; hotels without an award price sink to the end.
      points: (a, b) =>
        ((b.award && b.award.available && b.award.valuePer10k) || -1) -
          ((a.award && a.award.available && a.award.valuePer10k) || -1) ||
        b.valuePerThousand - a.valuePerThousand
    };
    pool.sort(sorters[settings.sort] || sorters.value);
    const bestValue = pool.reduce((max, item) => Math.max(max, item.valuePerThousand), 0) || 1;
    const items = pool.slice(0, settings.limit).map((item, index) =>
      Object.assign(item, {
        rank: index + 1,
        relativeValue: Math.round((item.valuePerThousand / bestValue) * 1000) / 10
      })
    );
    return { items, candidates: pool.length, unrated, unpriced, all: pool };
  }

  // One winner per net-cost band within the current scope.
  function bandChampions(options) {
    // Score the scope once, then bucket by net cost.
    const pool = getHappinessRanking(
      Object.assign({}, options, { band: "all", sort: "value", limit: 0 })
    ).all;
    return DATA.priceBands
      .filter((band) => band.id !== "all")
      .map((band) => {
        const inBand = pool.filter(
          (item) => item.cost.netCost >= band.min && item.cost.netCost <= band.max
        );
        return { band, item: inBand[0] || null, candidates: inBand.length };
      });
  }

  function splitEvidence(text) {
    return text
      .replace(/\r/g, "")
      .split(/[。！？!?\n]+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 5);
  }

  function findThemes(text) {
    const found = { positive: [], issue: [] };
    Object.keys(THEMES).forEach((type) => {
      THEMES[type].forEach((theme) => {
        if (theme.pattern.test(text) && !found[type].includes(theme.label)) {
          found[type].push(theme.label);
        }
      });
    });
    return found;
  }

  function truncateByChars(text, limit) {
    const chars = Array.from(text);
    if (chars.length <= limit) return text;
    return chars.slice(0, Math.max(1, limit - 1)).join("") + "…";
  }

  function scoreEvidence(entries) {
    const clean = (entries || []).filter(
      (entry) => entry && entry.text && entry.text.trim().length >= 8
    );
    if (!clean.length) return null;
    const positivePatterns = [
      /很好|不错|满意|推荐|喜欢|舒服|舒适|方便|热情|干净|整洁|丰富|漂亮|优秀|稳定/g,
      /非常好|太棒|完美|超出预期|值得再住|下次还来/g
    ];
    const negativePatterns = [
      /很差|较差|太差|失望|吵|噪音|隔音差|异味|不干净|不卫生|设施旧|老化|破损|很慢|排队|冷漠|不推荐|发霉|虫害/g,
      /非常差|太差|严重|投诉|无法接受|不会再住/g
    ];
    const polarities = clean.map((entry) => {
      const text = entry.text;
      let positive = 0;
      let negative = 0;
      const pos = text.match(positivePatterns[0]) || [];
      const neg = text.match(negativePatterns[0]) || [];
      positive += Math.min(4, pos.length) * 0.45;
      negative += Math.min(4, neg.length) * 0.7;
      if (positivePatterns[1].test(text)) positive += 0.45;
      if (negativePatterns[1].test(text)) negative += 0.55;
      if (/但是|不过|唯一|可惜|问题在于/.test(text)) negative += 0.2;
      if (text.length >= 30) positive += 0.1;
      return Math.max(-2, Math.min(2, positive - negative));
    });
    const average =
      polarities.reduce((total, value) => total + value, 0) / polarities.length;
    const sampleAdjustment = Math.min(1, clean.length / 10) * 0.25 + 0.75;
    const score = Math.max(
      5.2,
      Math.min(9.8, 7.5 + average * 0.85 * sampleAdjustment)
    );
    return {
      score: Math.round(score * 10) / 10,
      sampleSize: clean.length,
      positiveCount: polarities.filter((value) => value > 0.15).length,
      negativeCount: polarities.filter((value) => value < -0.15).length
    };
  }

  function summarizeEvidence(entries, options) {
    const clean = (entries || []).filter((entry) => entry && entry.text && entry.text.trim());
    if (!clean.length) {
      return null;
    }
    const allText = clean.map((entry) => entry.text).join("。");
    const themes = findThemes(allText);
    const sentences = clean.reduce((list, entry) => list.concat(splitEvidence(entry.text)), []);
    const sourceCounts = {};
    clean.forEach((entry) => {
      sourceCounts[entry.source] = (sourceCounts[entry.source] || 0) + 1;
    });
    const sourceText = Object.keys(sourceCounts)
      .map((sourceId) => {
        const source = DATA.reviewSources.find((item) => item.id === sourceId);
        return (source ? source.short : "其他") + " " + sourceCounts[sourceId];
      })
      .join("、");
    const evidenceLabel =
      options && options.label ? options.label : "主动导入证据";
    const useful = sentences
      .map((sentence) => ({
        sentence,
        themes: findThemes(sentence)
      }))
      .filter((item) => item.themes.positive.length || item.themes.issue.length)
      .slice(0, 3);
    const topics = themes.positive.slice(0, 4).join("、");
    const issues = themes.issue.slice(0, 3).join("、");
    let confidence = "低";
    if (clean.length >= 12) confidence = "中高";
    else if (clean.length >= 5) confidence = "中";
    const parts = [
      "已分析 " + clean.length + " 条" + evidenceLabel + "（" + sourceText + "）。",
      topics ? "文本中出现的主题包括" + topics + "。" : "",
      issues ? "建议进一步核验相关关键词：" + issues + "。" : "",
      useful.length
        ? "代表性原文：" +
          useful.map((item) => "“" + item.sentence + "”").join("；") +
          "。"
        : "",
      "当前样本置信度" + confidence + "，请结合官方信息与更多近期反馈判断。"
    ].filter(Boolean);
    return {
      text: truncateByChars(parts.join(""), 300),
      count: clean.length,
      sourceCounts,
      themes,
      confidence
    };
  }

  global.APP_LOGIC = {
    getDestination,
    getHotel,
    hotelsFor,
    formatMoney,
    calculateTripCost,
    knownRoute,
    recommendDestinations,
    parseQuery,
    getRankedHotels,
    valueIndex,
    VALUE_DEFAULTS,
    ELITE_TIERS,
    SEASONS,
    HAPPINESS_WEIGHTS,
    netCostBreakdown,
    awardRedemption,
    happinessBreakdown,
    seasonForMonth,
    seasonFit,
    evaluateHotelValue,
    getHappinessRanking,
    bandChampions,
    getManagementCounts,
    managementSummary,
    seasonStatus,
    nightlyRateFor,
    scoreEvidence,
    summarizeEvidence,
    truncateByChars
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.APP_LOGIC;
  }
})(typeof window !== "undefined" ? window : globalThis);
