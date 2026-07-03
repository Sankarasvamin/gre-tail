import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve(process.argv[2] || "data/gre_words.json");
const validSourceTypes = new Set(["original", "public_domain", "open_licensed", "manual_web_quote", "user_note"]);
const words = JSON.parse(readFileSync(path, "utf8"));

const errors = [];
const ids = new Set();

if (!Array.isArray(words)) {
  throw new Error("Vocabulary root must be an array.");
}

words.forEach((word, index) => {
  const label = word?.id || `#${index}`;
  requireString(word, "id", label);
  requireString(word, "word", label);
  requireString(word, "correct_cn", label);
  requireString(word, "definition_en", label);

  if (ids.has(word.id)) {
    errors.push(`${label}: duplicate id`);
  }
  ids.add(word.id);

  if (!validSourceTypes.has(word.source_type)) {
    errors.push(`${label}: invalid source_type ${word.source_type}`);
  }

  if (!Array.isArray(word.wrong_options_cn) || word.wrong_options_cn.length < 3) {
    errors.push(`${label}: expected at least 3 wrong_options_cn values`);
  }

  const optionSet = new Set([word.correct_cn, ...(word.wrong_options_cn || [])]);
  if (optionSet.size < 4) {
    errors.push(`${label}: options must contain at least 4 unique Chinese meanings`);
  }

  if (word.source_type === "manual_web_quote" && word.example_en && word.example_en.length > 220) {
    errors.push(`${label}: manual_web_quote example_en should stay short`);
  }
});

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${words.length} words in ${path}`);

function requireString(word, field, label) {
  if (!word || typeof word[field] !== "string" || word[field].trim() === "") {
    errors.push(`${label}: missing ${field}`);
  }
}
