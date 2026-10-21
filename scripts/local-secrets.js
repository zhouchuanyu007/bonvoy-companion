"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const secretsPath = process.env.BONVOY_SECRETS_FILE
  ? path.resolve(process.env.BONVOY_SECRETS_FILE)
  : path.join(root, "local-env", "secrets.properties");

function readProperties(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) values[key] = value;
  }
  return values;
}

const properties = readProperties(secretsPath);

function readSecret(name, options = {}) {
  const envValue = process.env[name];
  if (envValue && envValue.trim()) return envValue.trim();
  const value = properties[name];
  if (value && value.trim()) return value.trim();
  if (options.required) {
    throw new Error(
      `Missing ${name}. Add it to local-env/secrets.properties or set the ${name} environment variable.`
    );
  }
  return "";
}

module.exports = {
  readSecret,
  secretsPath
};
