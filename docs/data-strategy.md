# Data Strategy

GRE Tail uses a build-time search and import strategy. The browser app stays offline-first and only reads local JSON files.

## Source priority

1. **Curated local examples**
   - Hand-written original examples and user notes.
   - Highest trust when the sentence is natural and reviewed.

2. **Open sentence corpora**
   - Tatoeba official exports for complete English sentences and Chinese translations.
   - Keep sentence IDs, source URLs, license notes, and attribution.

3. **Open dictionaries with examples**
   - Open English WordNet for definitions and usage examples.
   - Wiktionary-derived data can be considered, but only through dump-based or licensed parsed datasets, not ad hoc page scraping.

4. **Licensed GRE repositories**
   - Use GitHub search manually or through explicit APIs to find GRE word lists.
   - Accept only repositories with clear licenses and usable structured data.
   - Record the repository URL, license, fields imported, and transformation script.

5. **Generated local fallback**
   - Only used to prevent blank UI when no sentence source is available.
   - Must be marked as generated fallback and should be replaced.

## Search rules

- Search at build time, never in the practice UI.
- Prefer exact word matching with boundaries.
- Prefer complete sentences: capitalized start, final punctuation, 6-26 English words.
- Prefer examples with a human Chinese translation from an open corpus.
- Do not bulk crawl Reddit, subtitle sites, script sites, forums, modern novels, or other copyrighted text sites.
- `manual_web_quote` is only for user-selected short quotes saved locally by the user.

## Current implemented sources

- ECDICT: primary word list and definitions, MIT.
- Tatoeba: planned/import script source for example sentences, CC BY by default with some CC0 entries.
- Open English WordNet: approved candidate for dictionary examples, CC-BY 4.0.

## Useful searches to run manually

- `site:github.com GRE vocabulary JSON license`
- `site:github.com GRE word list CSV MIT`
- `site:github.com GRE vocabulary definitions examples`
- `Open English WordNet JSON examples license`
- `Wiktionary parsed English examples dataset license`
