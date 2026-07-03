import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const sourcesPath = resolve("data/vocab_sources.json");
const sources = JSON.parse(readFileSync(sourcesPath, "utf8"));
const timeoutMs = Number(process.env.SOURCE_CHECK_TIMEOUT_MS) || 5000;

const results = [];

for (const source of sources) {
  const missing = ["id", "name", "url", "license", "status"].filter((field) => !source[field]);
  const urlStatus = await checkUrl(source.url);
  const downloadStatus = source.download_url ? await checkUrl(source.download_url) : { ok: null, status: "not configured" };

  results.push({
    id: source.id,
    name: source.name,
    status: source.status,
    license: source.license,
    metadata_ok: missing.length === 0,
    missing,
    url: urlStatus,
    download_url: downloadStatus
  });
}

console.log(JSON.stringify(results, null, 2));

if (results.some((result) => !result.metadata_ok)) {
  process.exit(1);
}

async function checkUrl(url) {
  if (!url) {
    return { ok: null, status: "missing" };
  }

  const curlStatus = checkUrlWithCurl(url, "");
  if (curlStatus.ok) {
    return curlStatus;
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
    return checkUrlWithCurl(url, error.message);
  }
}

function checkUrlWithCurl(url, fetchError) {
  const result = spawnSync("curl.exe", ["--ssl-no-revoke", "-L", "-I", "--connect-timeout", "10", "--max-time", "20", url], {
    encoding: "utf8"
  });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  const statusMatch = output.match(/HTTP\/[0-9.]+\s+([0-9]{3})/g);
  const lastStatus = statusMatch?.at(-1)?.match(/([0-9]{3})/)?.[1] || "";
  const status = lastStatus ? Number(lastStatus) : `fetch failed: ${fetchError}; curl failed`;

  return {
    ok: typeof status === "number" && status >= 200 && status < 400,
    status,
    checked_with: "curl.exe --ssl-no-revoke",
    fetch_error: fetchError
  };
}
