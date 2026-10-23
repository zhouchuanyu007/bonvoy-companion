"use strict";

// Independently recomputes per-10k-points value from the raw scraped samples
// and diffs it against APP_LOGIC.awardRedemption. Also prints data quality
// stats. Usage: node scripts/audit-award-points.js
const path = require("node:path");
const www = path.join(__dirname, "..", "app", "assets", "www");
globalThis.window = globalThis;
["catalog", "app-data", "hotel-value-signals", "hotel-award-points", "logic"].forEach((name) =>
  require(path.join(www, name + ".js"))
);
const catalog = globalThis.APP_CATALOG;
const store = globalThis.APP_AWARD_POINTS;
const logic = globalThis.APP_LOGIC;

const FX = { CNY: 1, HKD: 0.91, MOP: 0.88, TWD: 0.22 };
const regionCurrency = (hotel) => {
  const place = String(hotel.provinceFull || hotel.province || "");
  if (place.includes("香港")) return "HKD";
  if (place.includes("澳门")) return "MOP";
  if (place.includes("台湾")) return "TWD";
  return "CNY";
};

const problems = [];
const values = [];
const spreads = [];
let withRecord = 0;
let currencyMismatch = 0;

catalog.hotels.forEach((hotel) => {
  const record = store.hotels[hotel.id];
  if (!record) return;
  withRecord += 1;
  const samples = record.samples || [record];
  const priced = samples
    .filter((s) => s.available !== false && s.points > 0 && s.cashTotal > 0)
    .map((s) => {
      const currency = String(s.currency || regionCurrency(hotel)).toUpperCase();
      if (currency !== regionCurrency(hotel)) currencyMismatch += 1;
      return ((s.cashTotal * FX[currency]) / s.points) * 10000;
    })
    .sort((a, b) => a - b);
  const expected = priced.length ? priced[Math.floor((priced.length - 1) / 2)] : null;
  const actual = logic.awardRedemption(hotel, { pointValue: 400 });
  const got = actual ? actual.valuePer10k : null;
  if ((expected === null) !== (got === null) || (expected && Math.abs(expected - got) > 0.01)) {
    problems.push({ id: hotel.id, name: hotel.name, expected, got });
  }
  if (expected) values.push(expected);
  if (priced.length > 1) spreads.push(priced[priced.length - 1] / priced[0]);
});

const q = (list, p) => {
  const sorted = list.slice().sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) * p)] : null;
};
const round = (value, digits = 0) => (value === null ? null : Number(value.toFixed(digits)));
console.log(
  JSON.stringify(
    {
      dates: store.dates || [store.checkIn],
      catalogHotels: catalog.hotels.length,
      withAwardRecord: withRecord,
      withValue: values.length,
      valuePer10k: {
        p10: round(q(values, 0.1)),
        median: round(q(values, 0.5)),
        p90: round(q(values, 0.9)),
        max: round(q(values, 1))
      },
      aboveDefault400: values.filter((v) => v >= 400).length,
      bestToWorstNightRatio: { median: round(q(spreads, 0.5), 2), p90: round(q(spreads, 0.9), 2) },
      currencyMismatch,
      mismatches: problems.length
    },
    null,
    2
  )
);
if (problems.length) {
  console.log(problems.slice(0, 10));
  process.exitCode = 1;
}
