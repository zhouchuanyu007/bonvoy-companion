"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { readSecret } = require("../scripts/local-secrets");

const root = path.resolve(__dirname, "..");

const apiKey = readSecret("FLYAI_API_KEY", { required: true });
const signSecret = readSecret("FLYAI_SIGN_SECRET", { required: true });
const authorization = "Bearer " + apiKey;
const sha256 = (value) =>
  crypto.createHash("sha256").update(value, "utf8").digest("hex");

async function main() {
  const query =
    "2026双十一飞猪万豪房晚兑换券，1088元两晚，哪些酒店可兑换，哪些周末不加价。请给出商品名称、适用酒店、日期限制、加价规则和商品链接";
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "fliggy_ai_search",
      arguments: { query }
    }
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
      "user-agent": "BonvoyCompanion/0.11 Android",
      "x-flyai-ts": timestamp,
      "x-flyai-nonce": nonce,
      "x-flyai-sign-ver": "7",
      "x-flyai-sign-alg": "hmac-sha256",
      "x-flyai-sign": signature
    },
    body,
    signal: AbortSignal.timeout(65000)
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error("FlyAI HTTP " + response.status);
  }
  const rpc = JSON.parse(raw);
  const content =
    rpc.result &&
    rpc.result.content &&
    rpc.result.content[0] &&
    rpc.result.content[0].text;
  if (!content) throw new Error("FlyAI returned no content");
  const payload = JSON.parse(content);
  console.log(
    JSON.stringify(
      {
        status: payload.status,
        message: payload.message,
        characters: String(payload.data || "").length,
        preview: String(payload.data || "").slice(0, 12000)
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
