"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(
    root,
    "app",
    "src",
    "com",
    "bonvoy",
    "companion",
    "MainActivity.java"
  ),
  "utf8"
);
const keyMatch = source.match(
  /MEITUAN_TRAVEL_KEY\s*=\s*\n?\s*"([^"]+)"/
);
if (!keyMatch) {
  throw new Error("Missing Meituan travel key");
}

async function main() {
  const response = await fetch(
    "https://mcp-open-cater.meituan.com/v1/api/voyage/openapi/query",
    {
      method: "POST",
      headers: {
        Authorization: keyMatch[1],
        "SOURCE-FROM-CHANNEL": "clawhub",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        city: "南京",
        channel: "clawhub",
        query:
          "请推荐南京本地特色餐厅5-8家，优先包含大众点评必吃榜相关餐厅，并列出餐厅名、菜系、商圈、评分、人均、地址和营业时间；无法确认是否必吃榜时明确标注"
      }),
      signal: AbortSignal.timeout(140000)
    }
  );
  const raw = await response.text();
  if (!response.ok || !raw) {
    throw new Error(
      "Meituan travel request failed with HTTP " +
        response.status +
        (raw ? "：" + raw.slice(0, 1000) : "")
    );
  }
  const payload = JSON.parse(raw);
  if (payload.code !== 0 || !payload.data) {
    throw new Error("Meituan travel returned no result");
  }
  console.log(
    JSON.stringify(
      {
        status: response.status,
        code: payload.code,
        characters: String(payload.data).length,
        preview: String(payload.data).slice(0, 6000)
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
