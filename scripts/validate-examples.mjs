import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const examplesPath = resolve(process.argv[2] || "data/example_sentences.json");
const validSourceTypes = new Set(["original", "public_domain", "open_licensed", "manual_web_quote", "user_note"]);
const examples = JSON.parse(readFileSync(examplesPath, "utf8"));
const errors = [];

if (!Array.isArray(examples)) {
  throw new Error("Example library root must be an array.");
}

for (const example of examples) {
  const label = example.id || example.word || "unknown";
  for (const field of ["id", "word_id", "word", "example_en", "example_cn", "source_type", "source_name"]) {
    if (!example[field] || typeof example[field] !== "string") {
      errors.push(`${label}: missing ${field}`);
    }
  }
  if (!validSourceTypes.has(example.source_type)) {
    errors.push(`${label}: invalid source_type ${example.source_type}`);
  }
  if (!example.quality?.contains_word) {
    errors.push(`${label}: example does not contain target word`);
  }
  if (example.source_type === "manual_web_quote" && example.example_en.length > 220) {
    errors.push(`${label}: manual_web_quote is too long`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const generatedFallbacks = examples.filter((example) => example.quality?.generated_fallback).length;
if (generatedFallbacks > 0 && process.env.ALLOW_GENERATED_EXAMPLE_FALLBACK !== "1") {
  errors.push(`generated fallback examples are disabled by default: ${generatedFallbacks} found`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${examples.length} examples in ${examplesPath}`);
