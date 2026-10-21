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
