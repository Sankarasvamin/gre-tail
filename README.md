# GRE Tail

本项目是一个 localhost 自用的 GRE 四选一背词 WebApp MVP。它只读取本地 JSON 词库，用 `localStorage` 保存学习进度，不包含登录、后端、云同步、在线词典、实时 AI API 或自动爬取代码。

## 运行

在项目根目录启动本地静态服务器：

```powershell
node scripts/dev-server.mjs
```

然后打开：

```text
http://localhost:5173
```

直接双击打开 `index.html` 时，浏览器可能会阻止 `fetch` 读取本地 JSON，所以推荐使用 localhost。

## 主要文件

- `index.html`：练习页结构。
- `styles.css`：页面样式。
- `src/app.js`：题目选择、答案判断、进度更新、复习调度、统计渲染。
- `data/gre_words.json`：默认 GRE 词库，当前由 ECDICT 筛选生成。
- `data/gre_words.sample.json`：示例本地词库。
- `data/vocab_sources.json`：词库来源、许可证和用途说明。
- `docs/vocab-schema.md`：词条字段设计说明。
- `scripts/build-gre-vocab.mjs`：从公开词典源生成本地 GRE 词库。
- `scripts/validate-vocab.mjs`：校验本地词库结构和基本质量。

## 替换词库

默认词库是 `data/gre_words.json`。小样例保留在 `data/gre_words.sample.json`。

如果要从 ECDICT 重新生成本地 GRE 词库：

```powershell
node scripts/build-gre-vocab.mjs
```

脚本会下载 ECDICT CSV 到 `data/vendor/ecdict.csv`，筛选带 `gre` 标签的词条，并生成 `data/gre_words.json`。默认最多导入 1200 个词；可以临时调整：

```powershell
$env:MAX_WORDS=2000; node scripts/build-gre-vocab.mjs
```

生成后校验词库：

```powershell
node scripts/validate-vocab.mjs
```

检查登记过的数据源：

```powershell
node scripts/check-data-sources.mjs
```

也可以把自己的词库保存为 `data/gre_words.json`，或在 `src/app.js` 顶部修改：

```js
const WORDS_URL = "./data/gre_words.json";
```

每个词条建议包含：

```json
{
  "schema_version": 2,
  "id": "equivocal",
  "word": "equivocal",
  "phonetic": "",
  "pos": "adj",
  "correct_cn": "模棱两可的，含糊的",
  "wrong_options_cn": ["慷慨的", "脆弱的", "迅速的"],
  "translations_cn": ["模棱两可的，含糊的"],
  "definitions_en": ["unclear, ambiguous, or open to more than one interpretation"],
  "definition_en": "unclear, ambiguous, or open to more than one interpretation",
  "example_en": "His answer was so equivocal that nobody knew whether he had agreed or refused.",
  "example_cn": "他的回答非常模棱两可，没人知道他到底是同意了还是拒绝了。",
  "example_source": "original example",
  "source_type": "original",
  "source_note": "",
  "difficulty": "medium",
  "frequency": {
    "bnc": null,
    "contemporary": null
  },
  "exam_tags": ["gre"],
  "tags": ["GRE", "ambiguity"],
  "sources": [
    {
      "name": "manual",
      "url": "",
      "license": "user local note",
      "fields": ["example_en", "example_cn"]
    }
  ]
}
```

完整字段说明见 `docs/vocab-schema.md`。MVP 前端仍只要求 `id`、`word`、`correct_cn`、`wrong_options_cn`、`definition_en`、例句字段和 `source_type`，但增强字段可以用于后续筛选、排序、导入合并和更好的选项解释。

`source_type` 支持：

- `original`：原创例句。
- `public_domain`：公版文本例句。
- `open_licensed`：明确开放许可的语料，例如 CC BY 句库，必须保留来源和许可证。
- `manual_web_quote`：用户人工选择的少量公开可见短句，仅作本地个人学习材料。
- `user_note`：用户自己整理或改写的学习例句。

`manual_web_quote` 不应当用于批量抓取、全文保存、台词库、字幕库或小说摘录库。每个单词最多保留一条例句，`example_source` 写简短来源说明即可，中文翻译由用户自行整理。

## 例句库

默认例句库是 `data/example_sentences.json`，WebApp 会优先使用它；词条内的 `example_en` / `example_cn` 只作为 fallback。

重新生成例句库：

```powershell
node scripts/build-example-sentences.mjs
node scripts/validate-examples.mjs
```

生成逻辑：

- 优先保留本地原创 seed 例句。
- 网络可用时，从 Tatoeba 官方导出中筛选包含目标 GRE 单词的英文完整句，并匹配中文译句。
- 如果开放语料下载失败，则为每个词生成一条透明标注的原创学习笔记句，避免页面空白；这些 fallback 应逐步替换为人工整理、原创自然句、公版句或 Tatoeba 句。
- 不自动抓取 Reddit、字幕站、台词站、现代小说网站或论坛内容。

更完整的数据策略见 `docs/data-strategy.md`。原则是构建期搜索和检查开放来源，运行时只读本地 JSON。

## 词库来源

默认大词库由 ECDICT 本地词典数据筛选生成。ECDICT 提供英文释义、中文释义和考试标签，仓库许可证为 MIT。生成脚本只下载公开 CSV 数据并做本地格式转换，不抓取 Reddit、影视字幕站、小说网站或现代版权文本网站。

例句库优先支持 Tatoeba 官方导出。Tatoeba 是面向语言学习者的开放例句库，句子默认 CC BY，部分 CC0；项目下载页提供按语言拆分的句子和翻译链接文件。
