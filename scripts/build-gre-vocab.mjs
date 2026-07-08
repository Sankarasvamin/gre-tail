import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";

const ECDICT_URL = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv";
const ECDICT_REPO = "https://github.com/skywind3000/ECDICT";
const ECDICT_LICENSE = "MIT";
const rawPath = resolve("data/vendor/ecdict.csv");
const outputPath = resolve("data/gre_words.json");
const maxWords = Number(process.env.MAX_WORDS) || 1200;
const MIN_WORD_LENGTH = 4;
const MAX_WORD_LENGTH = 16;

const existingExamples = loadExistingExamples(resolve("data/gre_words.sample.json"));

await ensureDownloaded(ECDICT_URL, rawPath);

const csv = readFileSync(rawPath, "utf8");
const rows = parseCsv(csv);
const [header, ...records] = rows;
if (!header || !header.includes("word") || !header.includes("tag")) {
  throw new Error(`Invalid ECDICT CSV at ${rawPath}; refusing to overwrite ${outputPath}.`);
}
const columns = Object.fromEntries(header.map((name, index) => [name, index]));

const importedWords = records
  .map((row) => rowToWord(row, columns))
  .filter(Boolean)
  .filter(isGreStudyWord)
  .sort((left, right) => hardStudyScore(right) - hardStudyScore(left) || left.word.localeCompare(right.word))
  .slice(0, maxWords);
if (importedWords.length < 4) {
  throw new Error(`Only found ${importedWords.length} GRE words; refusing to overwrite ${outputPath}.`);
}
const words = withDistractors(importedWords);

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
  const phonetic = getCell(row, columns.phonetic).trim();
  const tag = getCell(row, columns.tag).toLowerCase();
  const translation = getCell(row, columns.translation);
  const definition = getCell(row, columns.definition);
  const pos = getCell(row, columns.pos).trim();
  const bnc = numberOrNull(getCell(row, columns.bnc));
  const frq = numberOrNull(getCell(row, columns.frq));

  if (!word || !tag.split(/\s+/).includes("gre") || !translation.trim() || !definition.trim()) {
    return null;
  }

  const example = existingExamples.get(word.toLowerCase());
  const translationsCn = splitMeanings(translation);
  const definitionsEn = splitMeanings(definition);
  const correctCn = translationsCn[0];
  const examTags = tag.split(/\s+/).filter(Boolean);

  return {
    schema_version: 2,
    id: word.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    word,
    phonetic,
    pos,
    correct_cn: correctCn,
    wrong_options_cn: [],
    translations_cn: translationsCn,
    definitions_en: definitionsEn,
    definition_en: definitionsEn[0],
    example_en: example?.example_en || "",
    example_cn: example?.example_cn || "",
    example_source: example?.example_source || "user note needed",
    source_type: example?.source_type || "user_note",
    source_note: example?.source_note || "Imported from ECDICT word data; add one local personal example if needed.",
    difficulty: inferDifficulty(word, tag),
    frequency: {
      bnc,
      contemporary: frq
    },
    exam_tags: examTags,
    tags: ["GRE", ...examTags.filter((item) => item !== "gre")],
    sources: [
      {
        name: "ECDICT",
        url: ECDICT_REPO,
        license: ECDICT_LICENSE,
        fields: ["word", "phonetic", "definition_en", "correct_cn", "pos", "exam_tags", "frequency"]
      }
    ]
  };
}

function getCell(row, index) {
  return typeof index === "number" ? row[index] || "" : "";
}

function splitMeanings(text) {
  return text
    .replace(/\\n/g, "\n")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function inferDifficulty(word, tag) {
  if (word.length >= 11) return "hard";
  if (word.length >= 8 || tag.includes("toefl")) return "medium";
  return "easy";
}

function isGreStudyWord(word) {
  return (word.exam_tags || []).length === 1
    && word.exam_tags[0] === "gre"
    && /^[a-z]+$/i.test(word.word)
    && word.word.length >= MIN_WORD_LENGTH
    && word.word.length <= MAX_WORD_LENGTH;
}

function hardStudyScore(word) {
  const rank = frequencyRank(word);
  const rarityScore = Math.min(rank, 50000) / 1000;
  const lengthScore = Math.min(Math.max(word.word.length - 5, 0), 8) * 2.5;
  const lengthBandScore = word.word.length >= 6 && word.word.length <= 14 ? 8 : 0;
  return rarityScore + lengthScore + lengthBandScore;
}

function frequencyRank(word) {
  const ranks = [word.frequency?.bnc, word.frequency?.contemporary]
    .map((rank) => Number(rank))
    .filter((rank) => Number.isFinite(rank) && rank > 0);
  if (ranks.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }
  return ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
}

function loadExistingExamples(path) {
  if (!existsSync(path)) {
    return new Map();
  }
  const words = JSON.parse(readFileSync(path, "utf8"));
  return new Map(words.map((item) => [String(item.word).toLowerCase(), item]));
}

function withDistractors(words) {
  return words.map((word) => {
    const candidates = words
      .filter((candidate) => candidate.id !== word.id)
      .filter((candidate) => candidate.correct_cn && candidate.correct_cn !== word.correct_cn)
      .sort((left, right) => distractorDistance(word, left) - distractorDistance(word, right));

    return {
      ...word,
      wrong_options_cn: unique(candidates.map((candidate) => candidate.correct_cn)).slice(0, 3),
      distractor_candidates: candidates.slice(0, 8).map((candidate) => ({
        word_id: candidate.id,
        word: candidate.word,
        correct_cn: candidate.correct_cn,
        definition_en: candidate.definition_en,
        reason: "same GRE source pool"
      }))
    };
  });
}

function distractorDistance(word, candidate) {
  const sameDifficulty = word.difficulty === candidate.difficulty ? 0 : 4;
  const samePos = word.pos && candidate.pos && word.pos[0] === candidate.pos[0] ? 0 : 2;
  const lengthGap = Math.abs(word.word.length - candidate.word.length) / 4;
  return sameDifficulty + samePos + lengthGap + Math.random();
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
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
