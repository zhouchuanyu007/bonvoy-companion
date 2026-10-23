"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

require(path.join(__dirname, "..", "app", "assets", "www", "catalog.js"));
require(path.join(__dirname, "..", "app", "assets", "www", "hotel-prices.js"));
require(path.join(__dirname, "..", "app", "assets", "www", "app-data.js"));
require(path.join(__dirname, "..", "app", "assets", "www", "hotel-value-signals.js"));
const LOGIC = require(path.join(__dirname, "..", "app", "assets", "www", "logic.js"));
const DATA = globalThis.APP_DATA;

const baseParams = {
  departure: "上海",
  month: 11,
  days: 3,
  people: 2,
  rooms: 1,
  budget: 5000,
  styles: ["赏秋"],
  lowWalking: true
};

assert.equal(new Set(DATA.hotels.map((hotel) => hotel.id)).size, DATA.hotels.length);
assert.ok(DATA.hotels.length > 500);
assert.ok(DATA.destinations.length > 100);
assert.ok(
  ["白银", "琼中黎族苗族自治县", "陵水黎族自治县"].some((name) =>
    DATA.destinations.some((destination) => destination.name === name)
  ),
  "Coverage must extend below tier-four cities where Marriott hotels operate"
);
assert.equal(
  new Set(DATA.destinations.map((destination) => destination.id)).size,
  DATA.destinations.length
);
assert.ok(
  DATA.hotels.every((hotel) => Boolean(LOGIC.getDestination(hotel.destinationId))),
  "Every hotel must belong to a destination"
);

const recommendations = LOGIC.recommendDestinations(baseParams);
assert.equal(recommendations.length, 3);
assert.ok(recommendations.every((item) => item.destination && item.hotel));
assert.ok(recommendations.every((item) => item.hotel.destinationId === item.destination.id));
assert.ok(recommendations.every((item) => item.cost.total > 0));

const managementCounts = LOGIC.getManagementCounts();
assert.equal(
  Object.values(managementCounts).reduce((total, count) => total + count, 0),
  DATA.hotels.length
);
assert.ok(
  LOGIC.managementSummary().includes("未核实"),
  "Unverified management must remain visible rather than being excluded"
);
assert.ok(DATA.regions.includes("西南"));
assert.ok(DATA.regions.includes("西北"));
assert.ok(!DATA.regions.includes("西部"));
assert.equal(
  DATA.destinations.find((item) => item.name === "成都").region,
  "西南"
);
assert.equal(
  DATA.destinations.find((item) => item.name === "西安").region,
  "西北"
);

const quality = LOGIC.getRankedHotels({
  mode: "quality",
  band: "all",
  brand: "all"
});
assert.equal(quality.length, 10);
assert.ok(quality.every((item, index) => index === 0 || quality[index - 1].hotel.quality >= item.hotel.quality));

const value = LOGIC.getRankedHotels({
  mode: "value",
  band: "500to900",
  brand: "all"
});
assert.ok(value.length > 0);
assert.ok(value.every((item) => item.hotel.price >= 501 && item.hotel.price <= 900));

const regionalRanking = LOGIC.getRankedHotels({
  mode: "quality",
  band: "all",
  region: "华东",
  brand: "all"
});
assert.ok(regionalRanking.length > 0);
assert.ok(regionalRanking.every((item) => item.hotel.region === "华东"));
const brandRanking = LOGIC.getRankedHotels({
  mode: "quality",
  band: "all",
  region: "华东",
  brand: "万豪"
});
assert.ok(brandRanking.length > 0);
assert.ok(brandRanking.every((item) => item.hotel.brand === "万豪"));
assert.equal(
  Object.values(DATA.catalogMeta.regionCounts).reduce(
    (total, count) => total + count,
    0
  ),
  DATA.hotels.length
);

const parsed = LOGIC.parseQuery(
  "十一月从上海出发，三天，两个人，预算 6000，想赏秋，少走路",
  {}
);
assert.equal(parsed.month, 11);
assert.equal(parsed.departure, "上海");
assert.equal(parsed.days, 3);
assert.equal(parsed.people, 2);
assert.equal(parsed.budget, 6000);
assert.ok(parsed.styles.includes("赏秋"));
assert.equal(parsed.lowWalking, true);

const evidenceSummary = LOGIC.summarizeEvidence([
  {
    source: "xhs_post",
    text: "位置很方便，早餐也很丰富。房间靠近电梯，晚上有一点噪音。服务响应很快。"
  },
  {
    source: "xhs_comment",
    text: "评论区补充：低楼层临街会比较吵，酒廊下午人很多。"
  }
]);
assert.ok(evidenceSummary);
assert.ok(Array.from(evidenceSummary.text).length <= 300);
assert.ok(evidenceSummary.text.includes("社交主帖"));
assert.ok(evidenceSummary.text.includes("评论区"));
assert.ok(evidenceSummary.text.includes("噪音"));

const longEvidence = LOGIC.summarizeEvidence([
  {
    source: "manual",
    text: "早餐很好，房间舒适，位置方便。".repeat(100)
  }
]);
assert.ok(Array.from(longEvidence.text).length <= 300);

const publicReviewScore = LOGIC.scoreEvidence(
  Array.from({ length: 10 }, (_, index) => ({
    source: index < 7 ? "fliggy" : "ctrip",
    text:
      "位置方便，房间干净，服务热情，早餐丰富。" +
      (index === 8 ? "不过临街房间隔音一般。" : "")
  }))
);
assert.ok(publicReviewScore);
assert.equal(publicReviewScore.sampleSize, 10);
assert.ok(publicReviewScore.score >= 5.2 && publicReviewScore.score <= 9.8);
const publicEvidenceSummary = LOGIC.summarizeEvidence(
  [
    {
      source: "fliggy",
      text: "位置方便，早餐丰富。"
    },
    {
      source: "ctrip",
      text: "房间干净，服务热情。"
    }
  ],
  { label: "公开平台评价" }
);
assert.ok(publicEvidenceSummary.text.includes("公开平台评价"));
assert.ok(publicEvidenceSummary.text.includes("飞猪评价"));
assert.ok(publicEvidenceSummary.text.includes("携程评价"));

// Happiness value ranking
const pricedHotel = DATA.hotels.find((hotel) => Number(hotel.totalPrice) > 0 && hotel.brandId !== "EL");
const memberCost = LOGIC.netCostBreakdown(pricedHotel, { tier: "member" });
const titaniumCost = LOGIC.netCostBreakdown(pricedHotel, { tier: "titanium" });
assert.ok(memberCost.netCost < memberCost.cost, "Points earned must lower net cost");
assert.ok(titaniumCost.earnedPoints > memberCost.earnedPoints, "Elite tiers earn more points");
assert.ok(titaniumCost.netCost < memberCost.netCost);
assert.equal(memberCost.basePerUsd, 10);
const discounted = LOGIC.netCostBreakdown(pricedHotel, { discountPct: 10 });
assert.ok(Math.abs(discounted.discount - memberCost.cost * 0.1) < 0.01);
const bonusCost = LOGIC.netCostBreakdown(pricedHotel, {}, () => 10000);
assert.ok(Math.abs(memberCost.netCost - bonusCost.netCost - 400) < 0.01, "10,000 points = ¥400");
assert.equal(LOGIC.netCostBreakdown({ id: "x", price: null }, {}), null);
const elementHotel = DATA.hotels.find((hotel) => hotel.brandId === "EL" && Number(hotel.price) > 0);
if (elementHotel) assert.equal(LOGIC.netCostBreakdown(elementHotel, {}).basePerUsd, 5);

const overall = LOGIC.getHappinessRanking({ limit: 20 });
assert.equal(overall.items.length, 20);
assert.ok(overall.items.every((item, index, list) => index === 0 || list[index - 1].valuePerThousand >= item.valuePerThousand));
assert.ok(overall.items.every((item) => item.happinessScore >= 0 && item.happinessScore <= 100));
assert.ok(overall.unpriced > 0, "Unpriced hotels must be counted, not ranked");
const band = DATA.priceBands.find((item) => item.id !== "all");
const banded = LOGIC.getHappinessRanking({ band: band.id, limit: 50 });
assert.ok(banded.items.every((item) => item.cost.netCost >= band.min && item.cost.netCost <= band.max), "Bands filter on net cost");
const cityName = overall.items[0].hotel.city;
const cityRanking = LOGIC.getHappinessRanking({ scope: "city:" + cityName, limit: 50 });
assert.ok(cityRanking.items.length > 0 && cityRanking.items.every((item) => item.hotel.city === cityName));
const winter = LOGIC.getHappinessRanking({ season: "winter", month: 1, limit: 50 });
assert.ok(winter.items.length > 0 && winter.items.every((item) => item.season.score > 0 && item.seasonBonus > 0));
const tinyScope = LOGIC.getHappinessRanking({ scope: "city:" + cityName, brand: overall.items[0].hotel.brand, limit: 10 });
assert.equal(tinyScope.items.length, Math.min(10, tinyScope.candidates), "Never pad rankings");
const champions = LOGIC.bandChampions({});
assert.equal(champions.length, DATA.priceBands.length - 1);

// Award redemption (points per night) and value per 10,000 points
const savedAward = globalThis.APP_AWARD_POINTS;
globalThis.APP_AWARD_POINTS = {
  checkIn: "2026-11-06",
  hotels: { [pricedHotel.id]: { points: 25000, cashTotal: 1250, available: true } }
};
const award = LOGIC.awardRedemption(pricedHotel, { pointValue: 400 });
assert.equal(award.points, 25000);
assert.equal(Math.round(award.valuePer10k), 500, "1250 / 25000 * 10000 = 500");
assert.ok(award.versusPrefs > 1, "Above user valuation means points win");
assert.equal(LOGIC.awardRedemption({ id: "none" }, {}), null);
globalThis.APP_AWARD_POINTS.hotels.tw = { points: 20000, cashTotal: 10000, available: true };
const twAward = LOGIC.awardRedemption({ id: "tw", provinceFull: "台湾省" }, { pointValue: 400 });
assert.equal(twAward.currency, "TWD");
assert.equal(Math.round(twAward.valuePer10k), 1100, "TWD 10000 * 0.22 / 20000 * 10000");
const twCost = LOGIC.netCostBreakdown(
  { price: 10000, totalPrice: 11000, priceMeta: { currency: "TWD" }, brandId: "x" },
  { pointValue: 400 }
);
assert.equal(Math.round(twCost.cost), 2420, "Non-CNY prices are converted before ranking");
delete globalThis.APP_AWARD_POINTS.hotels.tw;
const pointsSorted = LOGIC.getHappinessRanking({ sort: "points", limit: 3 });
assert.equal(pointsSorted.items[0].hotel.id, pricedHotel.id, "Points sort puts redeemable hotels first");
globalThis.APP_AWARD_POINTS = savedAward;

console.log(
  JSON.stringify(
    {
      hotels: DATA.hotels.length,
      destinations: DATA.destinations.length,
      recommendations: recommendations.map((item) => ({
        destination: item.destination.name,
        match: item.match,
        total: item.cost.total
      })),
      publicSummaryCharacters: Array.from(evidenceSummary.text).length
    },
    null,
    2
  )
);
