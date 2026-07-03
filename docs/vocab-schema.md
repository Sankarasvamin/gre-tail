# Vocabulary Schema

`data/gre_words.json` is an array of word objects. The app keeps the original MVP fields but also supports richer metadata for provenance, filtering, and future importers.

## Required fields

- `schema_version`: number. Current generated value is `2`.
- `id`: stable lowercase identifier.
- `word`: display word.
- `correct_cn`: one concise Chinese meaning used as the correct option.
- `wrong_options_cn`: at least three Chinese distractors.
- `definition_en`: concise English definition shown after answering.
- `example_en`: one local learning example, or an empty string if not yet curated.
- `example_cn`: user-curated Chinese translation, or an empty string.
- `example_source`: short source note.
- `source_type`: one of `original`, `public_domain`, `manual_web_quote`, `user_note`.
- `difficulty`: `easy`, `medium`, or `hard`.
- `tags`: display tags.

## Recommended fields

- `phonetic`: phonetic transcription when the source provides it.
- `pos`: part-of-speech distribution or source POS text.
- `translations_cn`: additional Chinese meanings.
- `definitions_en`: additional English definitions.
- `frequency`: object with source frequency ranks, such as `bnc` and `contemporary`.
- `exam_tags`: normalized source exam tags such as `gre`, `toefl`, `ielts`.
- `sources`: field-level provenance records with source name, URL, license, and imported fields.
- `distractor_candidates`: optional richer candidates used to explain wrong options.

## Source rules

`manual_web_quote` is only for a user-selected short quote in a local personal study file. Do not bulk crawl websites, save full copyrighted texts, or build subtitle/quote databases. For public redistribution, prefer `original`, `public_domain`, or licensed dictionary fields with clear attribution.
