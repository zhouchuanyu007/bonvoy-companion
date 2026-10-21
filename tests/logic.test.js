"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

require(path.join(__dirname, "..", "app", "assets", "www", "catalog.js"));
require(path.join(__dirname, "..", "app", "assets", "www", "hotel-prices.js"));
require(path.join(__dirname, "..", "app", "assets", "www", "app-data.js"));
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
