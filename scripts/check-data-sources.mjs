import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sourcesPath = resolve("data/vocab_sources.json");
const sources = JSON.parse(readFileSync(sourcesPath, "utf8"));
const timeoutMs = Number(process.env.SOURCE_CHECK_TIMEOUT_MS) || 5000;

const results = await Promise.all(sources.map(async (source) => {
  const missing = ["id", "name", "url", "license", "status"].filter((field) => !source[field]);
  const [urlStatus, downloadStatus] = await Promise.all([
    checkUrl(source.url),
    source.download_url ? checkUrl(source.download_url) : Promise.resolve({ ok: null, status: "not configured" })
  ]);

  return {
    id: source.id,
    name: source.name,
    status: source.status,
    license: source.license,
    metadata_ok: missing.length === 0,
    missing,
    url: urlStatus,
    download_url: downloadStatus
  };
}));

console.log(JSON.stringify(results, null, 2));

if (results.some((result) => !result.metadata_ok)) {
  process.exit(1);
}

async function checkUrl(url) {
  if (!url) {
    return { ok: null, status: "missing" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal
    });
    clearTimeout(timer);
    return {
      ok: response.ok,
      status: response.status,
      final_url: response.url
    };
  } catch (error) {
    clearTimeout(timer);
    return {
      ok: false,
      status: error.message
    };
  }
}
