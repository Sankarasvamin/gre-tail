"use strict";

const WORDS_URL = "./data/gre_words.json";
const EXAMPLES_URL = "./data/example_sentences.json";
const PROGRESS_KEY = "gre-tail-progress-v1";
const SESSION_KEY = "gre-tail-session-v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const MASTERED_LEVEL = 3;
const VALID_SOURCE_TYPES = new Set(["original", "public_domain", "open_licensed", "manual_web_quote", "user_note"]);

const state = {
  words: [],
  examplesByWordId: new Map(),
  progress: {},
  session: {
    date: todayKey(),
    completed: 0
  },
  currentQuestion: null,
  answered: false
};

const els = {
  loading: document.querySelector("#loading-state"),
  error: document.querySelector("#error-state"),
  quiz: document.querySelector("#quiz"),
  word: document.querySelector("#word"),
  wordProgress: document.querySelector("#word-progress"),
  options: document.querySelector("#options"),
  feedback: document.querySelector("#feedback"),
  resultBadge: document.querySelector("#result-badge"),
  correctAnswer: document.querySelector("#correct-answer"),
  definitionEn: document.querySelector("#definition-en"),
  optionExplanations: document.querySelector("#option-explanations"),
  exampleEn: document.querySelector("#example-en"),
  exampleCn: document.querySelector("#example-cn"),
  exampleSource: document.querySelector("#example-source"),
  nextQuestion: document.querySelector("#next-question"),
  resetProgress: document.querySelector("#reset-progress"),
  statToday: document.querySelector("#stat-today"),
  statTotal: document.querySelector("#stat-total"),
  statAccuracy: document.querySelector("#stat-accuracy"),
  statWrong: document.querySelector("#stat-wrong"),
  statMastered: document.querySelector("#stat-mastered")
};

init();

async function init() {
  bindEvents();
  state.progress = loadJson(PROGRESS_KEY, {});
  state.session = normalizeSession(loadJson(SESSION_KEY, state.session));
  renderStats();

  try {
    const [words, examples] = await Promise.all([loadWords(), loadExamples()]);
    state.words = words;
    state.examplesByWordId = indexExamples(examples);
    validateWords(state.words);
    els.loading.hidden = true;
    els.quiz.hidden = false;
    showNextQuestion();
  } catch (error) {
    showLoadError(error);
  }
}

function bindEvents() {
  els.nextQuestion.addEventListener("click", showNextQuestion);
  els.resetProgress.addEventListener("click", () => {
    if (!window.confirm("确定清空本地学习进度？词库文件不会受影响。")) {
      return;
    }
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(SESSION_KEY);
    state.progress = {};
    state.session = { date: todayKey(), completed: 0 };
    renderStats();
    showNextQuestion();
  });
}

async function loadWords() {
  const response = await fetch(WORDS_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`无法读取词库：${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function loadExamples() {
  try {
    const response = await fetch(EXAMPLES_URL, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }
    const examples = await response.json();
    return Array.isArray(examples) ? examples : [];
  } catch {
    return [];
  }
}

function indexExamples(examples) {
  const map = new Map();
  examples.forEach((example) => {
    if (!example.word_id || !example.example_en) {
      return;
    }
    const current = map.get(example.word_id);
    if (!current || getExampleScore(example) > getExampleScore(current)) {
      map.set(example.word_id, example);
    }
  });
  return map;
}

function validateWords(words) {
  if (!Array.isArray(words) || words.length < 4) {
    throw new Error("词库至少需要 4 个词条，才能生成四选一题目。");
  }

  const missing = words.find((word) => {
    return !word.id || !word.word || !word.correct_cn || !word.definition_en;
  });
  if (missing) {
    throw new Error("词库中存在缺少 id、word、correct_cn 或 definition_en 的词条。");
  }

  const invalidSource = words.find((word) => word.source_type && !VALID_SOURCE_TYPES.has(word.source_type));
  if (invalidSource) {
    throw new Error(`词条 ${invalidSource.id} 的 source_type 不受支持。`);
  }
}

function showLoadError(error) {
  els.loading.hidden = true;
  els.error.hidden = false;
  els.error.textContent = `${error.message} 请通过 localhost 静态服务器打开本应用，例如 node scripts/dev-server.mjs。`;
}

function showNextQuestion() {
  if (state.words.length === 0) {
    return;
  }
  state.currentQuestion = createQuestion(selectNextWord(state.words, state.progress), state.words);
  state.answered = false;
  renderQuestion(state.currentQuestion);
}

function selectNextWord(words, progress) {
  const now = Date.now();
  const unseen = words.filter((word) => !progress[word.id]);
  if (unseen.length > 0) {
    return randomItem(unseen);
  }

  const due = words.filter((word) => {
    const item = progress[word.id];
    return item && new Date(item.next_review_at).getTime() <= now;
  });
  if (due.length > 0) {
    return weightedPick(due, progress);
  }

  return weightedPick(words, progress);
}

function weightedPick(words, progress) {
  const weighted = [];
  words.forEach((word) => {
    const item = progress[word.id] || createEmptyProgress(word.id);
    let weight = 2;
    if (item.last_answer_correct === false) weight += 8;
    if (item.mastery_level >= MASTERED_LEVEL) weight = 1;
    if (item.wrong_count > item.correct_count) weight += 3;
    for (let index = 0; index < weight; index += 1) {
      weighted.push(word);
    }
  });
  return randomItem(weighted);
}

function createQuestion(word, allWords) {
  const options = buildOptions(word, allWords);
  return {
    word,
    options
  };
}

function buildOptions(word, allWords) {
  const optionMap = new Map();
  optionMap.set(word.correct_cn, {
    text: word.correct_cn,
    wordId: word.id,
    word: word.word,
    isCorrect: true,
    explanation: `正确释义：${word.correct_cn}`,
    definitionEn: word.definition_en
  });

  const localWrongOptions = Array.isArray(word.wrong_options_cn) ? word.wrong_options_cn : [];
  const localCandidateMap = new Map(
    (Array.isArray(word.distractor_candidates) ? word.distractor_candidates : [])
      .map((candidate) => [candidate.correct_cn, candidate])
  );

  localWrongOptions.forEach((text) => {
    const candidate = localCandidateMap.get(text);
    addWrongOption(optionMap, {
      text,
      word: candidate?.word || "",
      definitionEn: candidate?.definition_en || "",
      note: candidate?.word ? `来自 ${candidate.word}` : "本题内置干扰项"
    });
  });

  shuffle(allWords).forEach((candidate) => {
    if (candidate.id !== word.id) {
      addWrongOption(optionMap, {
        text: candidate.correct_cn,
        word: candidate.word,
        definitionEn: candidate.definition_en,
        note: `来自 ${candidate.word}`
      });
    }
  });

  return shuffle(Array.from(optionMap.values()).slice(0, 4));
}

function addWrongOption(optionMap, { text, word, definitionEn, note }) {
  if (!text || optionMap.has(text) || optionMap.size >= 4) {
    return;
  }
  optionMap.set(text, {
    text,
    wordId: null,
    word,
    isCorrect: false,
    explanation: `干扰项：${note}`,
    definitionEn
  });
}

function renderQuestion(question) {
  const item = state.progress[question.word.id];
  els.word.textContent = question.word.word;
  els.wordProgress.textContent = item
    ? `已见 ${item.seen_count} 次 · 掌握等级 ${item.mastery_level}`
    : "新词优先";
  els.feedback.hidden = true;
  els.options.innerHTML = "";

  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.className = "option-button";
    button.type = "button";
    button.textContent = `${String.fromCharCode(65 + index)}. ${option.text}`;
    button.addEventListener("click", () => handleAnswer(option, button));
    els.options.append(button);
  });
}

function handleAnswer(selectedOption, selectedButton) {
  if (state.answered) {
    return;
  }
  state.answered = true;

  const question = state.currentQuestion;
  const isCorrect = selectedOption.isCorrect;
  updateProgress(question.word, isCorrect);
  updateSession();
  renderStats();
  lockOptions(selectedOption, selectedButton);
  renderFeedback(question, selectedOption, isCorrect);
}

function updateProgress(word, isCorrect) {
  const now = new Date();
  const existing = state.progress[word.id] || createEmptyProgress(word.id);
  const currentMastery = Number(existing.mastery_level) || 0;
  const nextMastery = isCorrect ? Math.min(currentMastery + 1, 5) : Math.max(currentMastery - 1, 0);

  state.progress[word.id] = {
    word_id: word.id,
    seen_count: (Number(existing.seen_count) || 0) + 1,
    correct_count: (Number(existing.correct_count) || 0) + (isCorrect ? 1 : 0),
    wrong_count: (Number(existing.wrong_count) || 0) + (isCorrect ? 0 : 1),
    mastery_level: nextMastery,
    last_seen_at: now.toISOString(),
    next_review_at: isCorrect ? new Date(now.getTime() + 3 * DAY_MS).toISOString() : now.toISOString(),
    last_answer_correct: isCorrect
  };
  saveJson(PROGRESS_KEY, state.progress);
}

function createEmptyProgress(wordId) {
  return {
    word_id: wordId,
    seen_count: 0,
    correct_count: 0,
    wrong_count: 0,
    mastery_level: 0,
    last_seen_at: "",
    next_review_at: new Date(0).toISOString(),
    last_answer_correct: null
  };
}

function updateSession() {
  if (state.session.date !== todayKey()) {
    state.session = { date: todayKey(), completed: 0 };
  }
  state.session.completed += 1;
  saveJson(SESSION_KEY, state.session);
}

function lockOptions(selectedOption, selectedButton) {
  const buttons = Array.from(els.options.querySelectorAll(".option-button"));
  buttons.forEach((button, index) => {
    const option = state.currentQuestion.options[index];
    button.disabled = true;
    if (option.isCorrect) {
      button.classList.add("correct");
    }
    if (button === selectedButton) {
      button.classList.add("selected");
      if (!selectedOption.isCorrect) {
        button.classList.add("wrong");
      }
    }
  });
}

function renderFeedback(question, selectedOption, isCorrect) {
  const example = getExampleForWord(question.word);
  els.feedback.hidden = false;
  els.resultBadge.className = `result-badge ${isCorrect ? "correct" : "wrong"}`;
  els.resultBadge.textContent = isCorrect ? "正确" : "错误";
  els.correctAnswer.textContent = question.word.correct_cn;
  els.definitionEn.textContent = question.word.definition_en;
  els.optionExplanations.innerHTML = "";

  question.options.forEach((option) => {
    const item = document.createElement("li");
    const prefix = option.isCorrect ? "正确选项" : option.text === selectedOption.text ? "你的选择" : "干扰项";
    const definition = option.definitionEn ? ` 英文释义：${option.definitionEn}` : "";
    item.textContent = `${option.text}：${prefix}。${option.explanation}.${definition}`;
    els.optionExplanations.append(item);
  });

  els.exampleEn.textContent = example.example_en || "暂无高质量英文例句。";
  els.exampleCn.textContent = example.example_cn || "可以稍后在 data/example_sentences.json 中补充人工整理或开放许可例句。";
  els.exampleSource.textContent = formatExampleSource(example);
}

function getExampleForWord(word) {
  const libraryExample = state.examplesByWordId.get(word.id);
  if (libraryExample) {
    return libraryExample;
  }

  return {
    example_en: word.example_en || "",
    example_cn: word.example_cn || "",
    source_type: word.source_type || "user_note",
    source_name: word.example_source || "未标注来源",
    source_note: word.example_en ? word.source_note || "" : "No curated sentence is available for this word yet."
  };
}

function getExampleScore(example) {
  return Number(example.quality?.score) || 0;
}

function formatExampleSource(example) {
  const type = example.source_type || "user_note";
  const source = example.source_name || example.example_source || "未标注来源";
  const license = example.license ? ` · 许可：${example.license}` : "";
  const note = example.source_note ? ` · ${example.source_note}` : "";
  return `来源：${source} · 类型：${type}${license}${note}`;
}

function renderStats() {
  const records = Object.values(state.progress);
  const total = records.reduce((sum, item) => sum + (Number(item.seen_count) || 0), 0);
  const correct = records.reduce((sum, item) => sum + (Number(item.correct_count) || 0), 0);
  const wrongWords = records.filter((item) => (Number(item.wrong_count) || 0) > 0).length;
  const mastered = records.filter((item) => (Number(item.mastery_level) || 0) >= MASTERED_LEVEL).length;

  els.statToday.textContent = String(state.session.date === todayKey() ? state.session.completed : 0);
  els.statTotal.textContent = String(total);
  els.statAccuracy.textContent = total > 0 ? `${Math.round((correct / total) * 100)}%` : "0%";
  els.statWrong.textContent = String(wrongWords);
  els.statMastered.textContent = String(mastered);
}

function normalizeSession(session) {
  if (!session || session.date !== todayKey()) {
    return { date: todayKey(), completed: 0 };
  }
  return {
    date: session.date,
    completed: Number(session.completed) || 0
  };
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
