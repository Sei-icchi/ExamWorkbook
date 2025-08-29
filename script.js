// ==== Firebase Config (保存方式：Firebase Realtime Database / REST) ====
const firebaseConfig = {
  apiKey: "AIzaSyDcWdByC9LIILR19LlAWAor_VtY2y47kUk",
  authDomain: "exampractice-d2ed3.firebaseapp.com",
  databaseURL: "https://exampractice-d2ed3-default-rtdb.firebaseio.com",
  projectId: "exampractice-d2ed3",
};
const DB_URL = firebaseConfig.databaseURL + "/questions.json"; // 問題データ
const RESULT_URL = firebaseConfig.databaseURL + "/results.json"; // 成績データ（ユーザー別）

// ==== App State ====
let questions = {};            // { "001": {...}, "002": {...}, ... }
let sortedIds = [];            // ID昇順の配列（"001","002"...）
let currentUser = "";          // ユーザー名（start画面の入力）
let questionHistory = {};      // そのユーザーの { [id]: {count, correct, confidence, memo} }
let currentQuestion = null;

// ==== フィルタ（3ブロック） ====
let modeFilter = "fewest";     // 出題モード（デフォルト：出題回数が少ない問題）
let keywordFilter = "";        // キーワード（問題文に対して）
let genreFilter = "ALL";       // ジャンル（"ALL" or 具体的ジャンル）

// ==== DOM Refs ====
const startBtn = document.getElementById("start-btn");
const modeSelect = document.getElementById("mode-select");
const keywordInput = document.getElementById("keyword-input");
const genreSelect = document.getElementById("genre-select");

// ==== 入力イベント（即時反映） ====
if (modeSelect) modeSelect.addEventListener("change", () => { modeFilter = modeSelect.value; });
if (keywordInput) keywordInput.addEventListener("input", () => { keywordFilter = keywordInput.value.trim(); });
if (genreSelect) genreSelect.addEventListener("change", () => { genreFilter = genreSelect.value; });

// ==== スタート ====
if (startBtn) {
  startBtn.addEventListener("click", async () => {
    // ユーザー名（Firebase版では必要）※ start画面に <input id="username"> がある前提
    const nameInput = document.getElementById("username");
    if (!nameInput || !nameInput.value.trim()) {
      alert("ユーザー名を入力してください");
      return;
    }
    currentUser = nameInput.value.trim();

    // 既存の成績ロード
    try {
      const res = await fetch(RESULT_URL);
      const data = await res.json();
      if (data && data[currentUser]) {
        questionHistory = data[currentUser];
      } else {
        questionHistory = {};
      }
    } catch (e) {
      console.error("結果読込に失敗:", e);
      questionHistory = {};
    }

    // 問題ロード
    const qRes = await fetch(DB_URL);
    questions = await qRes.json();
    sortedIds = Object.keys(questions || {}).sort();

    // 画面遷移
    document.getElementById("start-screen")?.classList.add("hidden");
    document.getElementById("quiz-screen")?.classList.remove("hidden");
    showNextQuestion();
  });
}

// ==== 候補生成（3フィルタ） ====
function buildCandidates() {
  let ids = sortedIds.slice();

  // ブロック2：ジャンル
  if (genreFilter !== "ALL") {
    ids = ids.filter(id => questions[id]?.genre === genreFilter);
  }

  // ブロック3：キーワード（問題文）
  if (keywordFilter) {
    const kw = keywordFilter.toLowerCase();
    ids = ids.filter(id => (questions[id]?.question || "").toLowerCase().includes(kw));
  }

  // ブロック1：出題モード
  if (modeFilter === "incorrect") {
    ids = ids.filter(id => questionHistory[id]?.correct === false);
  } else if (modeFilter === "conf_low") {
    ids = ids.filter(id => (questionHistory[id]?.confidence || "") === "低");
  } else if (modeFilter === "conf_mid") {
    ids = ids.filter(id => (questionHistory[id]?.confidence || "") === "中");
  } else if (modeFilter === "conf_high") {
    ids = ids.filter(id => (questionHistory[id]?.confidence || "") === "高");
  } else if (modeFilter === "fewest") {
    // 出題回数が少ない順 + ID昇順で安定ソート
    ids.sort((a, b) => {
      const ac = questionHistory[a]?.count || 0;
      const bc = questionHistory[b]?.count || 0;
      if (ac !== bc) return ac - bc;
      return a.localeCompare(b);
    });
  } else if (modeFilter === "all") {
    ids.sort((a, b) => a.localeCompare(b));
  }

  return ids;
}

// ==== 次の問題ID（非ランダム / ID順巡回） ====
function pickNextId(previousId = null) {
  const candidates = buildCandidates();
  if (candidates.length === 0) return null;

  // fewest / all は ID昇順で次へ（末尾なら先頭に戻る）
  if (modeFilter === "fewest" || modeFilter === "all") {
    if (!previousId) return candidates[0];
    const idx = candidates.indexOf(previousId);
    if (idx === -1 || idx === candidates.length - 1) return candidates[0];
    return candidates[idx + 1];
  }

  // incorrect / conf_* も ID昇順で同様
  if (!previousId) return candidates[0];
  const idx = candidates.indexOf(previousId);
  if (idx === -1 || idx === candidates.length - 1) return candidates[0];
  return candidates[idx + 1];
}

// ==== 安全なシャッフル（選択肢のランダム表示に使用） ====
function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const j = r[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function showNextQuestion() {
  const nextId = pickNextId(currentQuestion?.id || null);
  if (!nextId) {
    alert("対象の問題がありません。");
    // 初期画面へ戻す
    document.getElementById("quiz-screen")?.classList.add("hidden");
    document.getElementById("start-screen")?.classList.remove("hidden");
    currentQuestion = null;
    return;
  }
  currentQuestion = questions[nextId];
  displayQuestion();
}

// ==== 問題表示 ====
function displayQuestion() {
  const q = currentQuestion;
  if (!q) return;

  // 問題文
  const qc = document.getElementById("question-container");
  qc.textContent = q.question || "";

  // 選択肢（c1 が "◯" の時は c1,c2 の2択固定。それ以外は c1〜c4 を毎回ランダム並び）
  const container = document.getElementById("choices-container");
  container.innerHTML = "";
  const keys = (q.c1 === "◯")
    ? ["c1", "c2"]
    : shuffle(["c1", "c2", "c3", "c4"]);

  keys.forEach(key => {
    const btn = document.createElement("button");
    btn.className = "choice-button";
    btn.dataset.key = key;
    btn.textContent = q[key] || "[選択肢未設定]";
    btn.onclick = () => handleAnswer(key, btn);
    container.appendChild(btn);
  });

  // 初期化
  document.getElementById("feedback")?.classList.add("hidden");
  document.getElementById("confidence-container")?.classList.add("hidden");

  // メモ復元
  const memoInput = document.getElementById("memo");
  if (memoInput) memoInput.value = questionHistory[q.id]?.memo || "";

  // 自信度ボタンの復元（回答回数>0のときだけ色付け）
  const saved = questionHistory[q.id];
  const savedConfidence = saved?.confidence;
  const savedCount = saved?.count || 0;
  document.querySelectorAll(".confidence").forEach(btn => {
    btn.classList.remove("selected");
    if (savedCount > 0 && btn.dataset.level === savedConfidence) {
      btn.classList.add("selected");
    }
  });

  // コントロール群（再生成・重複防止）
  const existing = document.getElementById("control-buttons");
  if (existing) existing.remove();
  const controls = document.createElement("div");
  controls.id = "control-buttons";

  // 成績ボタン
  const scoreBtn = document.createElement("button");
  scoreBtn.id = "score-btn";
  scoreBtn.textContent = "成績";
  scoreBtn.onclick = () => showScore();
  controls.appendChild(scoreBtn);

  // NEXT
  const nextBtn = document.createElement("button");
  nextBtn.id = "next-btn";
  nextBtn.textContent = "Next";
  nextBtn.disabled = !(savedConfidence && savedCount > 0); // 既に回答済み＋自信度ありなら有効
  nextBtn.onclick = () => {
    const memo = document.getElementById("memo")?.value || "";
    if (!questionHistory[q.id]) questionHistory[q.id] = {};
    questionHistory[q.id].memo = memo;
    saveResult();
    showNextQuestion();
  };
  controls.appendChild(nextBtn);

  // EXIT（初期画面へ）
  const exitBtn = document.createElement("button");
  exitBtn.id = "exit-btn";
  exitBtn.textContent = "Exit";
  exitBtn.onclick = () => {
    document.getElementById("quiz-screen")?.classList.add("hidden");
    document.getElementById("start-screen")?.classList.remove("hidden");
  };
  controls.appendChild(exitBtn);

  document.getElementById("confidence-container")?.appendChild(controls);
}

// ==== 回答処理 ====
function handleAnswer(selectedKey, button) {
  const isCorrect = selectedKey === currentQuestion.answer;

  // 選択肢ボタンをロック
  const buttons = document.querySelectorAll(".choice-button");
  buttons.forEach(b => (b.disabled = true));

  // 色付け：正解は青（.correct）/ 不正解は赤（.incorrect）
  buttons.forEach(b => {
    if (b.dataset.key === currentQuestion.answer) {
      b.classList.add("correct");
    } else if (b === button && !isCorrect) {
      b.classList.add("incorrect");
    }
  });

  // フィードバックと自信度UI
  const fb = document.getElementById("feedback");
  fb.classList.remove("hidden");
  fb.textContent = isCorrect ? "正解！" : "不正解！";
  document.getElementById("confidence-container")?.classList.remove("hidden");

  // 成績更新（count +1 / correct）
  if (!questionHistory[currentQuestion.id]) questionHistory[currentQuestion.id] = {};
  questionHistory[currentQuestion.id].correct = isCorrect;
  questionHistory[currentQuestion.id].count = (questionHistory[currentQuestion.id].count || 0) + 1;
  saveResult();

  // NEXT は自信度選択まで無効
  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) nextBtn.disabled = true;

  // 自信度ボタンのハンドラ：保存→色付け→NEXT解放
  document.querySelectorAll(".confidence").forEach(btn => {
    btn.onclick = () => {
      questionHistory[currentQuestion.id].confidence = btn.dataset.level;
      document.querySelectorAll(".confidence").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      saveResult();
      if (nextBtn) nextBtn.disabled = false;
    };
  });
}

// ==== Firebase へ保存 ====
function saveResult() {
  fetch(RESULT_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [currentUser]: questionHistory }),
  }).catch(err => console.error("保存失敗:", err));
}

// ==== 成績表示 ====
function showScore() {
  const scoreScreen = document.getElementById("score-screen");
  const scoreTable = document.getElementById("score-table");
  if (!scoreScreen || !scoreTable) return;

  scoreTable.innerHTML = "";
  const table = document.createElement("table");
  const header = document.createElement("tr");
  ["ID","問題","出題回数","正解数","自信度","メモ"].forEach(text => {
    const th = document.createElement("th");
    th.innerText = text;
    header.appendChild(th);
  });
  table.appendChild(header);

  // ID昇順で出力
  sortedIds.forEach(id => {
    const q = questions[id];
    const h = questionHistory[id];
    if (!q || !h) return;
    const tr = document.createElement("tr");
    const correctCount = h.correct ? 1 : 0; // （必要に応じて累積仕様に拡張可能）
    [id, q.question, h.count || 0, correctCount, h.confidence || "", h.memo || ""].forEach(val => {
      const td = document.createElement("td");
      td.innerText = val;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  scoreTable.appendChild(table);

  // 画面切替
  document.getElementById("quiz-screen")?.classList.add("hidden");
  scoreScreen.classList.remove("hidden");

  // 右下固定の戻る（初期画面へ）
  const backFab = document.getElementById("score-back-fab");
  if (backFab) {
    backFab.onclick = () => {
      scoreScreen.classList.add("hidden");
      document.getElementById("start-screen")?.classList.remove("hidden");
      document.getElementById("quiz-screen")?.classList.add("hidden");
    };
  }
}
