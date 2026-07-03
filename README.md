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
- `data/gre_words.sample.json`：示例本地词库。

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

也可以把自己的词库保存为 `data/gre_words.json`，或在 `src/app.js` 顶部修改：

```js
const WORDS_URL = "./data/gre_words.json";
```

每个词条建议包含：

```json
{
  "id": "equivocal",
  "word": "equivocal",
  "correct_cn": "模棱两可的，含糊的",
  "wrong_options_cn": ["慷慨的", "脆弱的", "迅速的"],
  "definition_en": "unclear, ambiguous, or open to more than one interpretation",
  "example_en": "His answer was so equivocal that nobody knew whether he had agreed or refused.",
  "example_cn": "他的回答非常模棱两可，没人知道他到底是同意了还是拒绝了。",
  "example_source": "original example",
  "source_type": "original",
  "source_note": "",
  "difficulty": "medium",
  "tags": ["GRE", "ambiguity"]
}
```

`source_type` 支持：

- `original`：原创例句。
- `public_domain`：公版文本例句。
- `manual_web_quote`：用户人工选择的少量公开可见短句，仅作本地个人学习材料。
- `user_note`：用户自己整理或改写的学习例句。

`manual_web_quote` 不应当用于批量抓取、全文保存、台词库、字幕库或小说摘录库。每个单词最多保留一条例句，`example_source` 写简短来源说明即可，中文翻译由用户自行整理。

## 词库来源

默认大词库由 ECDICT 本地词典数据筛选生成。ECDICT 提供英文释义、中文释义和考试标签，仓库许可证为 MIT。生成脚本只下载公开 CSV 数据并做本地格式转换，不抓取 Reddit、影视字幕站、小说网站或现代版权文本网站。
