"use strict";

const { readSecret } = require("../scripts/local-secrets");

async function main() {
  const key = readSecret("AMAP_KEY", { required: true });
  const response = await fetch(
    "https://restapi.amap.com/v3/weather/weatherInfo?city=320100&extensions=all&key=" +
      encodeURIComponent(key),
    { signal: AbortSignal.timeout(30000) }
  );
  const payload = await response.json();
  if (String(payload.status) !== "1" || !payload.forecasts?.length) {
    throw new Error(payload.info || "AMap weather query failed");
  }
  const casts = payload.forecasts[0].casts || [];
  console.log(
    JSON.stringify(
      {
        status: payload.status,
        count: casts.length,
        sample: casts.slice(0, 3).map((cast) => ({
          date: cast.date,
          dayWeather: cast.dayweather,
          dayTemp: cast.daytemp,
          nightTemp: cast.nighttemp
        }))
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
