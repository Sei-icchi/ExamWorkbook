// ==== Firebase Config ====
const firebaseConfig = {
  apiKey: "AIzaSyDcWdByC9LIILR19LlAWAor_VtY2y47kUk",
  authDomain: "exampractice-d2ed3.firebaseapp.com",
  databaseURL: "https://exampractice-d2ed3-default-rtdb.firebaseio.com",
  projectId: "exampractice-d2ed3",
};

// DB Endpoints
const DB_URL = firebaseConfig.databaseURL + "/questions.json";
const userResultUrl = (username) =>
  `${firebaseConfig.databaseURL}/results/${encodeURIComponent(username)}.json`;

// ==== App State ====
let questions = {};            // {id: questionObj}
let sortedIds = [];            // ID昇順
let currentUser = "";
let questionHistory = {};      // { [id]: { count, correct_count, incorrect_count, confidence, memo, last_correct } }
let currentQuestion = null;

// Filters (3 blocks)
let modeFilter = "fewest";     // 出題モード（デフォルト：出題回数が少ない問題）
let keywordFilter = "";        // キーワード
let genreFilter = "ALL";       // ジャンル

// ==== DOM Refs (start screen controls are in index.html) ====
const startBtn = document.getElementById("start-btn");
const modeSelect = document.getElementById("mode-select");
const keywordInput = document.getElementById("keyword-input");
const genreSelect = document.getElementById("genre-select");

// reflect UI -> state
if (modeSelect) modeSelect.addEventListener("change", () => { modeFilter = modeSelect.value; });
if (keywordInput) keywordInput.addEventListener("input", () => { keywordFilter = keywordInput.value.trim(); });
if (genreSelect) genreSelect.addEventListener("change", () => { genreFilter = genreSelect.value; });

// ==== Start Button ====
startBtn.addEventListener("click", async () => {
  const usernameInput = document.getElementById("username").value.trim();
  if (!usernameInput) {
    alert("ユーザー名を入力してください");
    return;
  }
  currentUser = usernameInput;

  // 既存成績のロード（ユーザー単位のノードにアクセス）
  try {
    const res = await fetch(userResultUrl(currentUser), { cache: "no-store" });
    const data = await res.json();
    questionHistory = data || {};
  } catch (e) {
    console.error("結果の読み込みに失敗:", e);
    questionHistory = {};
  }

  // 問題のロード
  const qRes = await fetch(DB_URL, { cache: "no-store" });
  questions = await qRes.json();
  sortedIds = Object.keys(questions).sort(); // "001","002"... を想定（文字列昇順）

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

  // Block1: 出題モード（単一選択・トグル適用）
  if (modeFilter === "incorrect") {
    ids = ids.filter(id => questionHistory[id]?.last_correct === false);
    ids.sort((a, b) => a.localeCompare(b));
  } else if (modeFilter === "conf_low") {
    ids = ids.filter(id => (questionHistory[id]?.confidence || "") === "低");
    ids.sort((a, b) => a.localeCompare(b));
  } else if (modeFilter === "conf_mid") {
    ids = ids.filter(id => (questionHistory[id]?.confidence || "") === "中");
    ids.sort((a, b) => a.localeCompare(b));
  } else if (modeFilter === "conf_high") {
    ids = ids.filter(id => (questionHistory[id]?.confidence || "") === "高");
    ids.sort((a, b) => a.localeCompare(b));
  } else if (modeFilter === "all") {
    // すべて（ID順）
    ids.sort((a, b) => a.localeCompare(b));
  } else {
    // fewest: 出題回数の少ない問題を優先（安定化版）
    // まず候補の中の最小出題回数を求め、その最小回数のものだけを対象にする
    let minCount = Infinity;
    ids.forEach(id => {
      const c = questionHistory[id]?.count || 0;
      if (c < minCount) minCount = c;
    });
    ids = ids.filter(id => (questionHistory[id]?.count || 0) === minCount);
    // 同回数グループは ID 昇順
    ids.sort((a, b) => a.localeCompare(b));
  }

  return ids;
}

// ==== Next Question Picker (ID順ベース・非ランダム) ====
function pickNextId(previousId = null) {
  const candidates = buildCandidates();

  if (candidates.length === 0) {
    alert("対象の問題がありません。");
    // 初期画面へ戻す
    document.getElementById("quiz-screen").classList.add("hidden");
    document.getElementById("start-screen").classList.remove("hidden");
    return null;
  }

  // ID順で進む。前問が存在する場合はその次へ、見つからなければ先頭。
  if (!previousId) return candidates[0];
  const idx = candidates.indexOf(previousId);
  if (idx === -1 || idx === candidates.length - 1) return candidates[0];
  return candidates[idx + 1];
}

function showNextQuestion() {
  const nextId = pickNextId(currentQuestion?.id || null);
  if (!nextId) return; // すでに初期画面へ戻している
  currentQuestion = questions[nextId];
  displayQuestion();
}

// ==== Render Current Question ====
function displayQuestion() {
  const q = currentQuestion;
  document.getElementById("question-container").innerText = q.question;

  // Choices: c1〜c4。c1が「◯」のときのみ2択表示（c1,c2）／それ以外は毎回ランダム
  const container = document.getElementById("choices-container");
  container.innerHTML = "";
  let keys = ["c1", "c2", "c3", "c4"];
  if (q.c1 === "◯") {
    keys = ["c1", "c2"]; // 並び固定
  } else {
    keys = shuffle(keys); // 毎回ランダム
  }

  keys.forEach(key => {
    const btn = document.createElement("button");
    btn.className = "choice-button";
    btn.dataset.key = key;
    btn.textContent = q[key] || "[選択肢未設定]";
    btn.onclick = () => handleAnswer(key, btn);
    container.appendChild(btn);
  });

  // 一旦非表示（回答後に表示）
  document.getElementById("feedback").classList.add("hidden");
  document.getElementById("confidence-container").classList.add("hidden");

  // 既存メモをセット（表示自体は回答後）
  const memoInput = document.getElementById("memo");
  memoInput.value = questionHistory[q.id]?.memo || "";

  // 自信度ボタンの色は、表示時に復元する（回答後に表示）
  // コントロール群（成績/NEXT/EXIT）は回答後に作るためここでは生成しない
}

// ==== Answer Handler ====
function handleAnswer(selectedKey, button) {
  const isCorrect = selectedKey === currentQuestion.answer;

  // 選択肢ボタンのロックと色分け
  const buttons = document.querySelectorAll(".choice-button");
  buttons.forEach(btn => btn.disabled = true);
  buttons.forEach(btn => {
    if (btn.dataset.key === currentQuestion.answer) {
      btn.classList.add("correct");
    } else if (btn === button && !isCorrect) {
      btn.classList.add("incorrect");
    }
  });

  // フィードバック表示
  const feedback = document.getElementById("feedback");
  feedback.classList.remove("hidden");
  feedback.innerText = isCorrect ? "正解！" : "不正解！";

  // 成績の更新（count/正解数/不正解数/最後の正誤）
  const id = currentQuestion.id;
  if (!questionHistory[id]) questionHistory[id] = {};
  const h = questionHistory[id];
  h.count = (h.count || 0) + 1;
  if (isCorrect) {
    h.correct_count = (h.correct_count || 0) + 1;
  } else {
    h.incorrect_count = (h.incorrect_count || 0) + 1;
  }
  h.last_correct = isCorrect;

  // 自信度とメモ UI を表示
  const ci = document.getElementById("confidence-container");
  ci.classList.remove("hidden");

  // 以前の自信度を色復元（ただし NEXT は初期は無効 → クリックで有効）
  const savedConfidence = h.confidence;
  const savedCount = h.count || 0;

  document.querySelectorAll(".confidence").forEach(b => {
    b.classList.remove("selected");
    if (savedCount > 0 && b.dataset.level === savedConfidence) {
      b.classList.add("selected");
    }
  });

  // 既存のボタン群があれば除去し、再生成
  const existingControl = document.getElementById("control-buttons");
  if (existingControl) existingControl.remove();
  const controlContainer = document.createElement("div");
  controlContainer.id = "control-buttons";

  // 成績ボタン
  const scoreBtn = document.createElement("button");
  scoreBtn.id = "score-btn";
  scoreBtn.textContent = "成績";
  scoreBtn.onclick = () => showScore();
  controlContainer.appendChild(scoreBtn);

  // NEXTボタン（初期は必ず無効化し、どれかの自信度を押したら有効化）
  const nextBtn = document.createElement("button");
  nextBtn.id = "next-btn";
  nextBtn.textContent = "Next";
  nextBtn.disabled = true; // ← クリックするまで無効
  nextBtn.onclick = () => {
    // メモ保存して次へ
    const memoInput = document.getElementById("memo");
    h.memo = memoInput.value || "";
    saveResult();
    showNextQuestion();
  };
  controlContainer.appendChild(nextBtn);

  // EXITボタン
  const exitBtn = document.createElement("button");
  exitBtn.id = "exit-btn";
  exitBtn.textContent = "Exit";
  exitBtn.onclick = () => {
    document.getElementById("quiz-screen").classList.add("hidden");
    document.getElementById("start-screen").classList.remove("hidden");
  };
  controlContainer.appendChild(exitBtn);

  ci.appendChild(controlContainer);

  // 自信度ボタンのハンドラ（選択したら保存＆NEXT有効化＆色反映）
  document.querySelectorAll(".confidence").forEach(btn => {
    btn.onclick = () => {
      h.confidence = btn.dataset.level;
      document.querySelectorAll(".confidence").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      document.getElementById("next-btn").disabled = false;
    };
  });
}

// ==== Save to Firebase (per user node) ====
function saveResult() {
  fetch(userResultUrl(currentUser), {
    method: "PATCH",
    mode: "cors",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(questionHistory),
    cache: "no-store",
  }).catch(err => console.error("保存に失敗:", err));
}

// ==== Shuffle (毎回違うランダム) ====
function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    // crypto ベースで偏りを減らす
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const j = r[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
    const correctCount = h.correct_count || 0;
    const row = [
      id,
      q.question,
      h.count || 0,
      correctCount,
      h.confidence || "",
      h.memo || ""
    ];
    row.forEach(val => {
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
