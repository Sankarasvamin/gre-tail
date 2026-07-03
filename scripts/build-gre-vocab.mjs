import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";

const ECDICT_URL = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv";
const rawPath = resolve("data/vendor/ecdict.csv");
const outputPath = resolve("data/gre_words.json");
const maxWords = Number(process.env.MAX_WORDS) || 1200;

const existingExamples = loadExistingExamples(resolve("data/gre_words.sample.json"));

await ensureDownloaded(ECDICT_URL, rawPath);

const csv = readFileSync(rawPath, "utf8");
const rows = parseCsv(csv);
const [header, ...records] = rows;
const columns = Object.fromEntries(header.map((name, index) => [name, index]));

const words = records
  .map((row) => rowToWord(row, columns))
  .filter(Boolean)
  .slice(0, maxWords);

writeFileSync(outputPath, `${JSON.stringify(words, null, 2)}\n`, "utf8");
console.log(`Wrote ${words.length} GRE words to ${outputPath}`);

async function ensureDownloaded(url, targetPath) {
  if (existsSync(targetPath)) {
    return;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  try {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    await pipeline(response.body, createWriteStream(targetPath));
    return;
  } catch (error) {
    console.warn(`Node fetch failed, trying curl.exe fallback: ${error.message}`);
  }

  const curl = spawnSync("curl.exe", ["--ssl-no-revoke", "-L", "-o", targetPath, url], {
    stdio: "inherit"
  });
  if (curl.status !== 0) {
    throw new Error("Failed to download ECDICT with both fetch and curl.exe.");
  }
}

function rowToWord(row, columns) {
  const word = getCell(row, columns.word).trim();
  const tag = getCell(row, columns.tag).toLowerCase();
  const translation = cleanLines(getCell(row, columns.translation));
  const definition = cleanLines(getCell(row, columns.definition));

  if (!word || !tag.split(/\s+/).includes("gre") || !translation || !definition) {
    return null;
  }

  const example = existingExamples.get(word.toLowerCase());
  const correctCn = firstMeaning(translation);

  return {
    id: word.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    word,
    correct_cn: correctCn,
    wrong_options_cn: [],
    definition_en: firstMeaning(definition),
    example_en: example?.example_en || "",
    example_cn: example?.example_cn || "",
    example_source: example?.example_source || "user note needed",
    source_type: example?.source_type || "user_note",
    source_note: example?.source_note || "Imported from ECDICT word data; add one local personal example if needed.",
    difficulty: inferDifficulty(word, tag),
    tags: ["GRE", ...tag.split(/\s+/).filter(Boolean).filter((item) => item !== "gre")]
  };
}

function getCell(row, index) {
  return typeof index === "number" ? row[index] || "" : "";
}

function cleanLines(text) {
  return text
    .replace(/\\n/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("; ");
}

function firstMeaning(text) {
  const [first] = text.split(/;|；|\n/).map((item) => item.trim()).filter(Boolean);
  return first || text.trim();
}

function inferDifficulty(word, tag) {
  if (word.length >= 11) return "hard";
  if (word.length >= 8 || tag.includes("toefl")) return "medium";
  return "easy";
}

function loadExistingExamples(path) {
  if (!existsSync(path)) {
    return new Map();
  }
  const words = JSON.parse(readFileSync(path, "utf8"));
  return new Map(words.map((item) => [String(item.word).toLowerCase(), item]));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}
