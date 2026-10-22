"use strict";

const path = require("node:path");

const root = path.resolve(__dirname, "..");
const { readSecret } = require("../scripts/local-secrets");
const key = readSecret("MEITUAN_TRAVEL_KEY", { required: true });

async function main() {
  const response = await fetch(
    "https://mcp-open-cater.meituan.com/v1/api/voyage/openapi/query",
    {
      method: "POST",
      headers: {
        Authorization: key,
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
  const structuredResponse = await fetch(
    "https://mcp-open-cater.meituan.com/v1/api/voyage/openapi/query",
    {
      method: "POST",
      headers: {
        Authorization: key,
        "SOURCE-FROM-CHANNEL": "clawhub",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        city: "南京",
        channel: "clawhub",
        query:
          "请推荐南京最值得去的5个景点和5家本地特色餐厅。只输出严格JSON，不要Markdown，不要解释。格式：{\"attractions\":[{\"name\":\"\",\"address\":\"\",\"reason\":\"\"}],\"restaurants\":[{\"name\":\"\",\"address\":\"\",\"cuisine\":\"\",\"reason\":\"\"}]}"
      }),
      signal: AbortSignal.timeout(140000)
    }
  );
  const structuredRaw = await structuredResponse.text();
  const structuredPayload = JSON.parse(structuredRaw);
  let structuredPreview = String(structuredPayload.data || "").slice(0, 5000);
  console.log(
    JSON.stringify(
      {
        status: response.status,
        code: payload.code,
        characters: String(payload.data).length,
        preview: String(payload.data).slice(0, 2000),
        structuredCode: structuredPayload.code,
        structuredPreview
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
