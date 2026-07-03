import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const wordsPath = resolve("data/gre_words.json");
const examplesPath = resolve("data/example_sentences.json");

const words = JSON.parse(readFileSync(wordsPath, "utf8"));
const examples = JSON.parse(readFileSync(examplesPath, "utf8"));
const covered = new Set(examples.map((example) => example.word_id));
const missing = words.filter((word) => !covered.has(word.id));

console.log(`Words: ${words.length}`);
console.log(`Examples: ${examples.length}`);
console.log(`Missing: ${missing.length}`);
console.log("");
console.log(missing.slice(0, 100).map((word) => `${word.word}\t${word.correct_cn}`).join("\n"));
