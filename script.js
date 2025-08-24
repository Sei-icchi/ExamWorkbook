// ==== Firebase Config ====
const firebaseConfig = {
  apiKey: "AIzaSyDcWdByC9LIILR19LlAWAor_VtY2y47kUk",
  authDomain: "exampractice-d2ed3.firebaseapp.com",
  databaseURL: "https://exampractice-d2ed3-default-rtdb.firebaseio.com",
  projectId: "exampractice-d2ed3",
};
const DB_URL = firebaseConfig.databaseURL + "/questions.json";
const RESULT_URL = firebaseConfig.databaseURL + "/results.json";

// ==== App State ====
let questions = {};            // {id: questionObj}
let sortedIds = [];            // ID昇順の並び
let currentUser = "";
let questionHistory = {};      // per-user stats map
let currentQuestion = null;

// Filters (3 blocks)
let modeFilter = "fewest";     // 出題モード（デフォルト：出題回数が少ない問題）
let keywordFilter = "";        // キーワード
let genreFilter = "ALL";       // ジャンル（ALL or具体的ジャンル）

// ==== DOM Refs ====
const startBtn = document.getElementById("start-btn");
const modeSelect = document.getElementById("mode-select");
const keywordInput = document.getElementById("keyword-input");
const genreSelect = document.getElementById("genre-select");

// ==== Event Listeners on Start Screen ====
modeSelect.addEventListener("change", () => { modeFilter = modeSelect.value; });
keywordInput.addEventListener("input", () => { keywordFilter = keywordInput.value.trim(); });
genreSelect.addEventListener("change", () => { genreFilter = genreSelect.value; });

// ==== Start Button ====
startBtn.addEventListener("click", async () => {
  const usernameInput = document.getElementById("username").value.trim();
  if (!usernameInput) { alert("ユーザー名を入力してください"); return; }
  currentUser = usernameInput;

  // 既存成績のロード
  const res = await fetch(RESULT_URL);
  const data = await res.json();
  if (data && data[currentUser]) questionHistory = data[currentUser];

  // 問題のロード
  const qRes = await fetch(DB_URL);
  questions = await qRes.json();
  // ID昇順を用意（数値的に並べたいなら pad されたID前提/または数値比較）
  sortedIds = Object.keys(questions).sort();

  // 画面遷移
  document.getElementById("start-screen").classList.add("hidden");
  document.getElementById("quiz-screen").classList.remove("hidden");
  showNextQuestion();
});

// ==== Candidate Builder (3フィルタ) ====
function buildCandidates() {
  let ids = sortedIds.slice();

  // Block3: ジャンル単一フィルタ
  if (genreFilter !== "ALL") {
    ids = ids.filter(id => questions[id]?.genre === genreFilter);
  }

  // Block2: キーワード（問題文のみ対象）
  if (keywordFilter) {
    const kw = keywordFilter.toLowerCase();
    ids = ids.filter(id => (questions[id]?.question || "").toLowerCase().includes(kw));
  }

  // Block1: 出題モード（単一選択）
  if (modeFilter === "incorrect") {
    ids = ids.filter(id => questionHistory[id]?.correct === false);
  } else if (modeFilter === "conf_low") {
    ids = ids.filter(id => (questionHistory[id]?.confidence || "") === "低");
  } else if (modeFilter === "conf_mid") {
    ids = ids.filter(id => (questionHistory[id]?.confidence || "") === "中");
  } else if (modeFilter === "conf_high") {
    ids = ids.filter(id => (questionHistory[id]?.confidence || "") === "高");
  } else if (modeFilter === "fewest") {
    // 「出題回数が少ない問題」を優先しつつ、ID順にバランスよく
    ids.sort((a, b) => {
      const ac = questionHistory[a]?.count || 0;
      const bc = questionHistory[b]?.count || 0;
      if (ac !== bc) return ac - bc;       // 出題回数が少ない順
      return a.localeCompare(b);           // 同回数なら ID 昇順
    });
  } else if (modeFilter === "all") {
    // すべて（ID順）
    ids.sort((a, b) => a.localeCompare(b));
  }

  return ids;
}

// ==== Next Question Picker (非ランダム・ID順ベース) ====
function pickNextId(previousId=null) {
  const candidates = buildCandidates();
  if (candidates.length === 0) return null;

  // fewest/all では ID 昇順で進む。前問が存在する場合はその次へ、なければ先頭。
  if (modeFilter === "fewest" || modeFilter === "all") {
    if (!previousId) return candidates[0];
    const idx = candidates.indexOf(previousId);
    if (idx === -1 || idx === candidates.length - 1) return candidates[0];
    return candidates[idx + 1];
  }

  // incorrect/conf_* の場合も、基本は ID 昇順で次へ
  if (!previousId) return candidates[0];
  const idx = candidates.indexOf(previousId);
  if (idx === -1 || idx === candidates.length - 1) return candidates[0];
  return candidates[idx + 1];
}

function showNextQuestion() {
  const nextId = pickNextId(currentQuestion?.id || null);
  if (!nextId) { alert("対象の問題がありません。"); return; }
  currentQuestion = questions[nextId];
  displayQuestion();
}

// ==== Render Current Question ====
function displayQuestion() {
  const q = currentQuestion;
  document.getElementById("question-container").innerText = q.question;

  // Choices: c1〜c4。c1が「◯」のときのみ2択表示（c1,c2）
  const container = document.getElementById("choices-container");
  container.innerHTML = "";
  const keys = (q.c1 === "◯") ? ["c1","c2"] : ["c1","c2","c3","c4"]; // 選択肢のランダム化は削除

  keys.forEach(key => {
    const btn = document.createElement("button");
    btn.className = "choice-button";
    btn.dataset.key = key;
    btn.textContent = q[key] || "[選択肢未設定]";
    btn.onclick = () => handleAnswer(key, btn);
    container.appendChild(btn);
  });

  document.getElementById("feedback").classList.add("hidden");
  document.getElementById("confidence-container").classList.add("hidden");

  // 既存メモ表示
  const memoInput = document.getElementById("memo");
  memoInput.value = questionHistory[q.id]?.memo || "";

  // 自信度ボタンの復元（回答回数に応じた色）
  const saved = questionHistory[q.id];
  const savedConfidence = saved?.confidence;
  const savedCount = saved?.count || 0;

  document.querySelectorAll(".confidence").forEach(btn => {
    btn.classList.remove("selected");
    if (savedCount > 0 && btn.dataset.level === savedConfidence) {
      btn.classList.add("selected");
    }
  });

  // ボタン群を下部に生成（重複防止）
  const existingControl = document.getElementById("control-buttons");
  if (existingControl) existingControl.remove();
  const controlContainer = document.createElement("div");
  controlContainer.id = "control-buttons";

  const scoreBtn = document.createElement("button");
  scoreBtn.id = "score-btn";
  scoreBtn.textContent = "成績";
  scoreBtn.onclick = () => showScore();
  controlContainer.appendChild(scoreBtn);

  const nextBtn = document.createElement("button");
  nextBtn.id = "next-btn";
  nextBtn.textContent = "Next";
  // 初期は、過去回答があって自信度が保存されている場合のみ有効
  nextBtn.disabled = !(savedConfidence && savedCount > 0);
  nextBtn.onclick = () => {
    // メモ保存
    if (!questionHistory[q.id]) questionHistory[q.id] = {};
    questionHistory[q.id].memo = memoInput.value;
    saveResult();
    showNextQuestion();
  };
  controlContainer.appendChild(nextBtn);

  const exitBtn = document.createElement("button");
  exitBtn.id = "exit-btn";
  exitBtn.textContent = "Exit";
  exitBtn.onclick = () => {
    document.getElementById("quiz-screen").classList.add("hidden");
    document.getElementById("start-screen").classList.remove("hidden");
  };
  controlContainer.appendChild(exitBtn);

  document.getElementById("confidence-container").appendChild(controlContainer);
}

// ==== Answer Handler ====
function handleAnswer(selectedKey, button) {
  const isCorrect = selectedKey === currentQuestion.answer;
  const buttons = document.querySelectorAll(".choice-button");
  buttons.forEach(btn => btn.disabled = true);

  buttons.forEach(btn => {
    if (btn.dataset.key === currentQuestion.answer) {
      btn.classList.add("correct");
    } else if (btn === button && !isCorrect) {
      btn.classList.add("incorrect");
    }
  });

  document.getElementById("feedback").classList.remove("hidden");
  document.getElementById("feedback").innerText = isCorrect ? "正解！" : "不正解！";
  document.getElementById("confidence-container").classList.remove("hidden");

  // 履歴更新
  if (!questionHistory[currentQuestion.id]) questionHistory[currentQuestion.id] = {};
  questionHistory[currentQuestion.id].correct = isCorrect;
  questionHistory[currentQuestion.id].count = (questionHistory[currentQuestion.id].count || 0) + 1;

  // 自信度の選択 → NEXT有効化
  document.querySelectorAll(".confidence").forEach(btn => {
    btn.onclick = () => {
      questionHistory[currentQuestion.id].confidence = btn.dataset.level;
      document.querySelectorAll(".confidence").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      const nb = document.getElementById("next-btn");
      if (nb) nb.disabled = false;
    };
  });
}

// ==== Save to Firebase ====
function saveResult() {
  fetch(RESULT_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [currentUser]: questionHistory }),
  });
}

// ==== Score Screen ====
function showScore() {
  const scoreScreen = document.getElementById("score-screen");
  const scoreTable = document.getElementById("score-table");
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
    const correctCount = h.correct ? 1 : 0; // 単純カウント（必要なら累積に拡張）
    [id, q.question, h.count || 0, correctCount, h.confidence || "", h.memo || ""].forEach(val => {
      const td = document.createElement("td");
      td.innerText = val;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  scoreTable.appendChild(table);

  // 画面切替
  document.getElementById("quiz-screen").classList.add("hidden");
  scoreScreen.classList.remove("hidden");

  // 右下固定フローティング戻るボタン
  const backFab = document.getElementById("score-back-fab");
  backFab.onclick = () => {
    scoreScreen.classList.add("hidden");
    document.getElementById("quiz-screen").classList.remove("hidden");
  };
}
