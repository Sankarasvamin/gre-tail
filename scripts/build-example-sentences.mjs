import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";

const TATOEBA_BASE = "https://downloads.tatoeba.org/exports/per_language";
const TATOEBA_FILES = {
  eng: `${TATOEBA_BASE}/eng/eng_sentences.tsv.bz2`,
  cmn: `${TATOEBA_BASE}/cmn/cmn_sentences.tsv.bz2`,
  links: `${TATOEBA_BASE}/eng/eng-cmn_links.tsv.bz2`
};
const vendorDir = resolve("data/vendor/tatoeba");
const outputPath = resolve("data/example_sentences.json");
const wordsPath = resolve("data/gre_words.json");
const seedPath = resolve("data/gre_words.sample.json");
const maxWords = Number(process.env.EXAMPLE_MAX_WORDS) || 1200;

const words = JSON.parse(readFileSync(wordsPath, "utf8")).slice(0, maxWords);
const examples = new Map();

for (const example of seedExamples(seedPath)) {
  examples.set(example.word_id, example);
}

try {
  const paths = await ensureTatoebaFiles();
  const imported = importTatoebaExamples(words, paths);
  for (const example of imported) {
    if (!examples.has(example.word_id) || example.quality.score > examples.get(example.word_id).quality.score) {
      examples.set(example.word_id, example);
    }
  }
} catch (error) {
  console.warn(`Tatoeba import skipped: ${error.message}`);
}

const output = words
  .map((word) => examples.get(word.id) || generatedOriginalExample(word))
  .filter(Boolean)
  .sort((left, right) => left.word.localeCompare(right.word));

writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${output.length} examples to ${outputPath}`);

function seedExamples(path) {
  if (!existsSync(path)) {
    return [];
  }

  return JSON.parse(readFileSync(path, "utf8"))
    .filter((word) => word.example_en && word.example_cn)
    .map((word) => ({
      id: `example-${word.id}-original-1`,
      word_id: word.id,
      word: word.word,
      example_en: word.example_en,
      example_cn: word.example_cn,
      source_type: word.source_type || "original",
      source_name: word.example_source || "GRE Tail seed examples",
      source_url: "",
      license: word.source_type === "original" ? "project original" : "user local note",
      attribution: "",
      source_note: word.source_note || "Original local seed example.",
      quality: scoreExample(word.word, word.example_en, word.example_cn)
    }));
}

function generatedOriginalExample(word) {
  const template = chooseTemplate(word);
  const exampleEn = template.en;
  const exampleCn = template.cn;

  return {
    id: `example-${word.id}-generated-original-1`,
    word_id: word.id,
    word: word.word,
    example_en: exampleEn,
    example_cn: exampleCn,
    source_type: "original",
    source_name: "GRE Tail generated original fallback",
    source_url: "",
    license: "project original",
    attribution: "",
    source_note: "Generated locally from dictionary meaning as a temporary study sentence; replace with a curated original, public-domain, or Tatoeba sentence when available.",
    quality: {
      ...scoreExample(word.word, exampleEn, exampleCn),
      generated_fallback: true
    }
  };
}

function chooseTemplate(word) {
  const meaning = stripPartOfSpeech(word.correct_cn);
  const definition = stripDefinition(word.definition_en);
  const lower = word.word.toLowerCase();

  return {
    en: `In this study note, "${lower}" is used to express the idea of ${definition}.`,
    cn: `在这条学习笔记中，“${lower}”用来表达“${meaning}”这一含义。`
  };
}

function stripPartOfSpeech(text) {
  return String(text || "")
    .replace(/^(vt\.|vi\.|v\.|n\.|adj\.|adv\.|a\.)\s*/i, "")
    .split(/[,，;；]/)[0]
    .trim() || "该词的含义";
}

function stripDefinition(text) {
  return String(text || "")
    .replace(/^(n\.|v\.|adj\.|adv\.|s\.)\s*/i, "")
    .split(/;|,/)[0]
    .trim() || "consistent with the word's dictionary meaning";
}

async function ensureTatoebaFiles() {
  mkdirSync(vendorDir, { recursive: true });
  const targets = {
    eng: resolve(vendorDir, "eng_sentences.tsv"),
    cmn: resolve(vendorDir, "cmn_sentences.tsv"),
    links: resolve(vendorDir, "eng-cmn_links.tsv")
  };

  for (const [key, url] of Object.entries(TATOEBA_FILES)) {
    if (!existsSync(targets[key])) {
      const compressed = `${targets[key]}.bz2`;
      await download(url, compressed);
      extractBzip2(compressed, targets[key]);
    }
  }

  return targets;
}

async function download(url, targetPath) {
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
    console.warn(`Node fetch failed for ${url}, trying curl.exe fallback: ${error.message}`);
  }

  const curl = spawnSync("curl.exe", ["--ssl-no-revoke", "-L", "--retry", "3", "-o", targetPath, url], {
    stdio: "inherit"
  });
  if (curl.status !== 0) {
    throw new Error(`Failed to download ${url}`);
  }
}

function extractBzip2(sourcePath, targetPath) {
  const result = spawnSync("tar.exe", ["-xOf", sourcePath], {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024
  });
  if (result.status !== 0 || !result.stdout) {
    throw new Error(`Failed to extract ${sourcePath}`);
  }
  writeFileSync(targetPath, result.stdout, "utf8");
}

function importTatoebaExamples(words, paths) {
  const wantedWords = new Map(words.map((word) => [word.word.toLowerCase(), word]));
  const englishSentences = new Map();
  const matchedEnglishIds = new Set();

  for (const line of readLines(paths.eng)) {
    const [id, lang, text] = parseTsvLine(line);
    if (lang !== "eng" || !isGoodEnglishSentence(text)) {
      continue;
    }

    const matchedWord = findMatchedWord(text, wantedWords);
    if (matchedWord) {
      englishSentences.set(id, { id, text, word: matchedWord });
      matchedEnglishIds.add(id);
    }
  }

  if (englishSentences.size === 0) {
    return [];
  }

  const linkedChineseIds = new Map();
  for (const line of readLines(paths.links)) {
    const [left, right] = parseTsvLine(line);
    if (matchedEnglishIds.has(left)) {
      linkedChineseIds.set(left, right);
    }
  }

  const neededChineseIds = new Set(linkedChineseIds.values());
  const chineseSentences = new Map();
  for (const line of readLines(paths.cmn)) {
    const [id, lang, text] = parseTsvLine(line);
    if (lang === "cmn" && neededChineseIds.has(id) && isGoodChineseSentence(text)) {
      chineseSentences.set(id, text);
    }
  }

  const bestByWord = new Map();
  for (const [englishId, entry] of englishSentences) {
    const chineseId = linkedChineseIds.get(englishId);
    const translation = chineseSentences.get(chineseId);
    if (!translation) {
      continue;
    }

    const quality = scoreExample(entry.word.word, entry.text, translation);
    const example = {
      id: `example-${entry.word.id}-tatoeba-${englishId}`,
      word_id: entry.word.id,
      word: entry.word.word,
      example_en: entry.text,
      example_cn: translation,
      source_type: "open_licensed",
      source_name: "Tatoeba",
      source_url: `https://tatoeba.org/en/sentences/show/${englishId}`,
      license: "CC BY 2.0 / CC0 depending on sentence contributor",
      attribution: `Tatoeba sentence ${englishId}`,
      source_note: "Imported from Tatoeba official exports for local study use.",
      quality
    };

    const current = bestByWord.get(entry.word.id);
    if (!current || example.quality.score > current.quality.score) {
      bestByWord.set(entry.word.id, example);
    }
  }

  return Array.from(bestByWord.values());
}

function readLines(path) {
  return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
}

function parseTsvLine(line) {
  return line.split("\t");
}

function findMatchedWord(sentence, wantedWords) {
  const lower = sentence.toLowerCase();
  for (const [word, entry] of wantedWords) {
    const pattern = new RegExp(`(^|[^a-z])${escapeRegex(word)}([^a-z]|$)`, "i");
    if (pattern.test(lower)) {
      return entry;
    }
  }
  return null;
}

function isGoodEnglishSentence(text) {
  const words = text.split(/\s+/).filter(Boolean);
  return /^[A-Z"']/.test(text)
    && /[.!?]"?$/.test(text)
    && words.length >= 6
    && words.length <= 26
    && !/[()[\]{}]/.test(text);
}

function isGoodChineseSentence(text) {
  return text.length >= 4 && text.length <= 80 && /[\u4e00-\u9fff]/.test(text);
}

function scoreExample(word, exampleEn, exampleCn) {
  const tokenCount = exampleEn.split(/\s+/).filter(Boolean).length;
  let score = 0;
  if (new RegExp(`(^|[^a-z])${escapeRegex(word)}([^a-z]|$)`, "i").test(exampleEn)) score += 35;
  if (/^[A-Z"']/.test(exampleEn)) score += 10;
  if (/[.!?]"?$/.test(exampleEn)) score += 15;
  if (tokenCount >= 8 && tokenCount <= 20) score += 20;
  if (exampleCn && /[\u4e00-\u9fff]/.test(exampleCn)) score += 15;
  if (!/[()[\]{}]/.test(exampleEn)) score += 5;
  return {
    is_complete_sentence: /[.!?]"?$/.test(exampleEn),
    contains_word: new RegExp(`(^|[^a-z])${escapeRegex(word)}([^a-z]|$)`, "i").test(exampleEn),
    has_translation: Boolean(exampleCn),
    score
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
