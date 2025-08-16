// ====== script.js（モードロジック撤去・バランス出題版） ======
const firebaseConfig = {
  apiKey: "AIzaSyDcWdByC9LIILR19LlAWAor_VtY2y47kUk",
  authDomain: "exampractice-d2ed3.firebaseapp.com",
  databaseURL: "https://exampractice-d2ed3-default-rtdb.firebaseio.com",
  projectId: "exampractice-d2ed3",
};

const DB_URL = firebaseConfig.databaseURL + "/questions.json";
const RESULT_URL = firebaseConfig.databaseURL + "/results.json";

let questions = {};
let currentQuestion = null;
let currentUser = "";
let currentGenre = [];
let questionHistory = {};
let lastServedId = null; // 最小回数グループ内の巡回用

document.getElementById("start-btn").addEventListener("click", async () => {
  const usernameInput = document.getElementById("username").value.trim();
  if (!usernameInput) {
    alert("ユーザー名を入力してください");
    return;
  }
  currentUser = usernameInput;

  // モード選択ボックスは残すが、内容とロジックは無効化
  const modeSelect = document.getElementById("mode-select");
  if (modeSelect) {
    modeSelect.innerHTML = '<option value="balanced"> </option>';
    modeSelect.disabled = false;
  }

  const checkboxes = document.querySelectorAll("input[type=checkbox]:checked");
  currentGenre = Array.from(checkboxes).map(cb => cb.value);
  if (currentGenre.length === 0) {
    alert("ジャンルを1つ以上選択してください");
    return;
  }

  // 履歴読み込み
  try {
    const res = await fetch(RESULT_URL);
    const data = await res.json();
    if (data && data[currentUser]) {
      questionHistory = data[currentUser];
    }
  } catch (e) {
    console.warn("成績データの取得に失敗しました:", e);
  }

  // 問題取得
  try {
    const qRes = await fetch(DB_URL);
    questions = await qRes.json();
  } catch (e) {
    alert("問題データの取得に失敗しました。設定をご確認ください。");
    return;
  }

  document.getElementById("start-screen").classList.add("hidden");
  document.getElementById("quiz-screen").classList.remove("hidden");

  lastServedId = null;
  showNextQuestion();
});

// "001" -> 1 のようにIDを数値化して比較順を安定化
function idToNum(id) {
  const n = parseInt(String(id).replace(/^0+/, ''), 10);
  return isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
}

// バランス出題
function showNextQuestion() {
  const all = Object.values(questions || {});
  let candidates = all.filter(q => currentGenre.includes(q.genre));

  if (candidates.length === 0) {
    alert("対象の問題がありません。");
    return;
  }

  // 出題回数を算出
  const withCount = candidates.map(q => {
    const cnt = questionHistory[q.id]?.count || 0;
    return { q, count: cnt };
  });

  // 最小回数のみ抽出
  const minCount = Math.min(...withCount.map(x => x.count));
  let minGroup = withCount.filter(x => x.count === minCount).map(x => x.q);

  // ID昇順
  minGroup.sort((a, b) => idToNum(a.id) - idToNum(b.id));

  // lastServedId より大きいIDを優先、無ければ先頭
  let next = null;
  if (lastServedId !== null) {
    const lastNum = idToNum(lastServedId);
    next = minGroup.find(q => idToNum(q.id) > lastNum) || null;
  }
  if (!next) next = minGroup[0];

  currentQuestion = next;
  lastServedId = currentQuestion.id;

  displayQuestion();
}

function displayQuestion() {
  const q = currentQuestion;
  document.getElementById("question-container").innerText = q.question;

  // 選択肢
  let choices = ["c1", "c2", "c3", "c4"];
  if (q.c1 === "◯") choices = ["c1", "c2"];

  // c1が◯のときは順序固定／それ以外は選択肢だけシャッフル
  const displayChoices = (q.c1 === "◯") ? choices : shuffle(choices);

  // 選択肢描画
  const container = document.getElementById("choices-container");
  container.innerHTML = "";
  displayChoices.forEach(key => {
    const text = q[key] || "[選択肢未設定]";
    const btn = document.createElement("button");
    btn.className = "choice-button";
    btn.dataset.key = key;
    btn.textContent = text;
    btn.onclick = () => handleAnswer(key, btn);
    container.appendChild(btn);
  });

  // 初期化
  document.getElementById("feedback").classList.add("hidden");
  document.getElementById("confidence-container").classList.add("hidden");

  // メモ復元
  const memoInput = document.getElementById("memo");
  memoInput.value = questionHistory[q.id]?.memo || "";

  // 自信度ボタン復元（回答回数0なら無色）
  const saved = questionHistory[q.id];
  const savedConfidence = saved?.confidence;
  const savedCount = saved?.count || 0;
  document.querySelectorAll(".confidence").forEach(btn => {
    btn.classList.remove("selected");
    if (savedCount > 0 && btn.dataset.level === savedConfidence) {
      btn.classList.add("selected");
    }
  });

  // コントロール行を再構築（重複防止）
  const existingControl = document.getElementById("control-buttons");
  if (existingControl) existingControl.remove();

  const controlContainer = document.createElement("div");
  controlContainer.id = "control-buttons";

  // 成績（NEXTの左）
  const scoreBtn = document.createElement("button");
  scoreBtn.id = "score-btn";
  scoreBtn.textContent = "成績";
  scoreBtn.onclick = () => showScore();
  controlContainer.appendChild(scoreBtn);

  // NEXT（自信度が未設定なら無効）
  const nextBtn = document.createElement("button");
  nextBtn.id = "next-btn";
  nextBtn.textContent = "Next";
  nextBtn.disabled = !(savedConfidence && savedCount > 0);
  nextBtn.onclick = () => {
    if (!questionHistory[q.id]) questionHistory[q.id] = {};
    questionHistory[q.id].memo = memoInput.value;
    saveResult();
    showNextQuestion();
  };
  controlContainer.appendChild(nextBtn);

  // EXIT
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

function handleAnswer(selectedKey, button) {
  const isCorrect = selectedKey === currentQuestion.answer;

  // 選択肢ボタンをロック
  const buttons = document.querySelectorAll(".choice-button");
  buttons.forEach(btn => btn.disabled = true);

  // 色付け：正解は青／不正解の押下は赤
  buttons.forEach(btn => {
    if (btn.dataset.key === currentQuestion.answer) {
      btn.classList.add("correct");
    } else if (btn === button && !isCorrect) {
      btn.classList.add("incorrect");
    }
  });

  // 正誤表示
  document.getElementById("feedback").classList.remove("hidden");
  document.getElementById("feedback").innerText = isCorrect ? "正解！" : "不正解！";
  document.getElementById("confidence-container").classList.remove("hidden");

  // 履歴更新
  if (!questionHistory[currentQuestion.id]) questionHistory[currentQuestion.id] = {};
  questionHistory[currentQuestion.id].correct = isCorrect;
  questionHistory[currentQuestion.id].count = (questionHistory[currentQuestion.id].count || 0) + 1;

  // 自信度：選択で色付け＆NEXT解放
  document.querySelectorAll(".confidence").forEach(btn => {
    btn.onclick = () => {
      questionHistory[currentQuestion.id].confidence = btn.dataset.level;
      document.querySelectorAll(".confidence").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      const nextBtn = document.getElementById("next-btn");
      if (nextBtn) nextBtn.disabled = false;
    };
  });
}

function saveResult() {
  fetch(RESULT_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [currentUser]: questionHistory }),
  });
}

// 選択肢の表示順だけシャッフル
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 成績一覧
function showScore() {
  const scoreScreen = document.getElementById("score-screen");
  const scoreTable = document.getElementById("score-table");
  scoreTable.innerHTML = "";

  const table = document.createElement("table");
  const header = document.createElement("tr");
  ["ID", "問題", "出題回数", "正解数", "自信度", "メモ"].forEach(text => {
    const th = document.createElement("th");
    th.innerText = text;
    header.appendChild(th);
  });
  table.appendChild(header);

  Object.keys(questionHistory).sort((a, b) => idToNum(a) - idToNum(b)).forEach(id => {
    const q = questions[id];
    const h = questionHistory[id];
    if (!q || !h) return;

    const tr = document.createElement("tr");
    const correctCount = h.correct ? 1 : 0; // 直近正誤を1/0表示（必要に応じて拡張）
    [id, q.question, h.count || 0, correctCount, h.confidence || "", h.memo || ""].forEach(val => {
      const td = document.createElement("td");
      td.innerText = val;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  scoreTable.appendChild(table);
  document.getElementById("quiz-screen").classList.add("hidden");
  scoreScreen.classList.remove("hidden");
}

function backToQuiz() {
  document.getElementById("score-screen").classList.add("hidden");
  document.getElementById("quiz-screen").classList.remove("hidden");
}
