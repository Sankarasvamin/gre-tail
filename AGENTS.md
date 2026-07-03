# AGENTS.md

本项目是一个本地自用的 GRE 四选一背词 WebApp，暂定名为 GRE Tail / Vocab Tail。项目定位是轻量、离线优先、localhost 自用，不做公开部署，不做商业化，不做影视/小说台词数据库。

核心目标：

1. 帮助用户通过四选一题型快速识别 GRE 高频词中文释义。
2. 每题答题后即时显示正误、正确释义、所有选项解释、正确单词的中英例句。
3. 记录用户答题表现，并基于简单 spaced repetition 逻辑安排复习。
4. 数据来源以本地 GRE 词库为主，例句可以来自原创、公版文本或用户手工整理的现代文本短句，但不得实现自动爬取 Reddit、影视字幕站、小说网站或其他现代版权文本网站的功能。

技术原则：

1. 默认本地运行，优先使用 localhost。
2. 优先使用静态本地数据文件，例如 JSON/CSV；用户进度可先用 localStorage 或 IndexedDB 保存。
3. 不要默认接入在线数据库、Supabase、后端服务、实时 AI API 或实时词典 API。
4. 不要把这个项目复杂化为大型平台。先完成 MVP，再考虑扩展。
5. 代码要清晰、可维护，避免过度抽象。
6. UI 要简洁，核心是看到词  选择释义  得到反馈  下一题。
7. 所有功能设计都应服务于背词效率，而不是炫技。

内容与版权边界：

1. 项目只面向本地个人学习使用。
2. 不要实现自动抓取 Reddit、影视剧台词、现代小说文本、字幕站内容的功能。
3. 如果数据字段中存在 example_source、source_type、source_note，只用于用户手工标注来源，不用于公开展示或分发。
4. 推荐 source_type 取值包括：original、public_domain、manual_quote、user_note。
5. 例句优先使用原创例句或公版文本。现代影视/小说短句只作为用户手工整理的本地学习材料，不作为产品卖点。

推荐数据结构：
每个单词对象建议包含：

* id
* word
* correct_cn
* wrong_options_cn
* definition_en
* example_en
* example_cn
* example_source
* source_type
* source_note
* difficulty
* tags

用户进度建议包含：

* word_id
* seen_count
* correct_count
* wrong_count
* mastery_level
* last_seen_at
* next_review_at
* last_answer_correct

题目生成规则：

1. 每题展示一个英文单词和四个中文释义选项。
2. 一个选项为正确释义，三个选项为干扰项。
3. 干扰项可以来自本题数据中的 wrong_options_cn，也可以从其他词的 correct_cn 中抽取，但必须避免重复和明显错误格式。
4. 选项顺序每次随机。
5. 用户选择后，显示正误反馈。
6. 反馈区展示：

   * 正确答案
   * 本题单词英文释义
   * 所有四个中文选项的简短说明
   * 正确单词的 example_en 和 example_cn
   * 下一题按钮

复习规则 MVP：

1. 第一次进入时优先展示未见过的词。
2. 答错的词应进入近期复习池。
3. 答对：next_review_at 推迟到 3 天后。
4. 答错：next_review_at 设置为当天稍后或下一轮优先出现。
5. 连续多次答对后可提高 mastery_level。
6. mastered 词汇降低出现频率，但不要永久消失。

页面结构建议：

1. 主练习页：显示当前题目、四个选项、反馈、下一题。
2. 简单统计区：今日完成数、正确率、错词数、已掌握词数。
3. 错词页或错词筛选：展示最近答错的词。
4. 数据加载失败时给出清晰提示。

不要做的事情：

1. 不要做登录系统。
2. 不要做排行榜。
3. 不要做社交分享。
4. 不要做在线抓取。
5. 不要做复杂后端。
6. 不要把项目与 Nirmana 主项目耦合。
7. 不要为了完整词典体验加入过多功能。

优先完成可以运行的最小闭环：本地词库  出题  选择  判断正误  显示例句  保存进度  下一题。
