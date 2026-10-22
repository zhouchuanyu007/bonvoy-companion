"use strict";

const crypto = require("node:crypto");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const { readSecret } = require("../scripts/local-secrets");
const authorization = "Bearer " + readSecret("FLYAI_API_KEY", { required: true });
const signSecret = readSecret("FLYAI_SIGN_SECRET", { required: true });
const sha256 = (value) =>
  crypto.createHash("sha256").update(String(value), "utf8").digest("hex");

async function callTool(name, args) {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name, arguments: args }
  });
  const timestamp = String(Date.now());
  const nonce = crypto.randomBytes(16).toString("hex");
  const canonical =
    "POST\n/mcp\n" +
    timestamp +
    "\n" +
    nonce +
    "\n" +
    sha256(body) +
    "\n" +
    sha256(authorization);
  const signature = crypto
    .createHmac("sha256", signSecret)
    .update(canonical)
    .digest("base64url");
  const response = await fetch("https://flyai.open.fliggy.com/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization,
      "x-ttid": "ai2c(sk.clawhub)",
      "user-agent": "BonvoyCompanion/0.12 Android",
      "x-flyai-ts": timestamp,
      "x-flyai-nonce": nonce,
      "x-flyai-sign-ver": "7",
      "x-flyai-sign-alg": "hmac-sha256",
      "x-flyai-sign": signature
    },
    body,
    signal: AbortSignal.timeout(65000)
  });
  const rpc = JSON.parse(await response.text());
  const text = rpc.result?.content?.[0]?.text;
  if (!text) throw new Error("No MCP content");
  return JSON.parse(text);
}

function interesting(value, prefix = "") {
  const result = {};
  if (!value || typeof value !== "object") return result;
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? prefix + "." + key : key;
    if (/point|promo|bonus|activity|campaign|tag|label|benefit/i.test(key)) {
      result[next] = child;
    } else if (child && typeof child === "object" && !Array.isArray(child)) {
      Object.assign(result, interesting(child, next));
    }
  }
  return result;
}

async function main() {
  const payload = await callTool("search_marriott_hotels", {
    destName: "南京市",
    checkInDate: "2026-10-23",
    checkOutDate: "2026-10-24"
  });
  const items = payload.data?.itemList || [];
  const promoSearch = await callTool("search_marriott_hotels", {
    destName: "南京市",
    keyWords: "闪促",
    checkInDate: "2026-10-23",
    checkOutDate: "2026-10-24"
  });
  const ai = await callTool("fliggy_ai_search", {
    query:
      "2026年10月万豪闪促，预订酒店额外赠送万豪积分，列出参与酒店、积分数量和活动日期"
  });
  console.log(
    JSON.stringify(
      {
        status: payload.status,
        count: items.length,
        promoSearchCount: (promoSearch.data?.itemList || []).length,
        promoSearchNames: (promoSearch.data?.itemList || [])
          .slice(0, 10)
          .map((item) => item.name),
        aiStatus: ai.status,
        aiMessage: ai.message,
        aiPreview: String(ai.data || "").slice(0, 8000),
        samples: items.slice(0, 8).map((item) => ({
          name: item.name,
          keys: Object.keys(item),
          promotions: interesting(item)
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
