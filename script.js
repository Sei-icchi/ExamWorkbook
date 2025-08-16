// ====== Firebase 設定 ======
const firebaseConfig = {
  apiKey: "AIzaSyDcWdByC9LIILR19LlAWAor_VtY2y47kUk",
  authDomain: "exampractice-d2ed3.firebaseapp.com",
  databaseURL: "https://exampractice-d2ed3-default-rtdb.firebaseio.com",
  projectId: "exampractice-d2ed3",
};

const DB_URL = firebaseConfig.databaseURL + "/questions.json";
const RESULT_URL = firebaseConfig.databaseURL + "/results.json";

// ====== アプリ状態 ======
let questions = {};                // { "001": {...}, "002": {...}, ... }
let orderedIds = [];               // 選択ジャンルで絞り込んだIDの昇順
let currentIdx = 0;                // orderedIds の現在位置（円環的に使用）
let firstRound = true;             // 1巡目：ID順で出題するフラグ
let currentQuestion = null;
let currentUser = "";
let currentGenre = [];             // チェックボックスで選んだジャンル
let questionHistory = {};          // { [id]: { count, correct, confidence, memo } }

// ====== 初期化（スタート） ======
document.getElementById("start-btn").addEventListener("click", async () => {
  const usernameInput = document.getElementById("username").value.trim();
  if (!usernameInput) {
    alert("ユーザー名を入力してください");
    return;
  }
  currentUser = usernameInput;

  const checkboxes = document.querySelectorAll("input[type=checkbox]:checked");
  currentGenre = Array.from(checkboxes).map(cb => cb.value);
  if (currentGenre.length === 0) {
    alert("ジャンルを1つ以上選択してください");
    return;
  }

  // 成績（履歴）を取得
  try {
    const res = await fetch(RESULT_URL);
    const data = await res.json();
    if (data && data[currentUser]) {
      questionHistory = data[currentUser];
    }
  } catch (e) {
    console.warn("成績の読み込みに失敗:", e);
  }

  // 問題データの取得
  const qRes = await fetch(DB_URL);
  questions = await qRes.json();

  // 選択ジャンルでフィルタし、ID昇順リストを作成
  orderedIds = Object.values(questions)
    .filter(q => currentGenre.includes(q.genre))
    .map(q => q.id)
    .sort(); // "001","002",... の文字列昇順でOK

  if (orderedIds.length === 0) {
    alert("選択したジャンルの問題がありません。");
    return;
  }

  currentIdx = 0;
  firstRound = true;

  // 画面切替
  document.getElementById("start-screen").classList.add("hidden");
  document.getElementById("quiz-screen").classList.remove("hidden");
  showNextQuestion();
});

// ====== 次の問題（1巡目はID順、2巡目以降は“出題回数が少ない”問題優先） ======
function showNextQuestion() {
  if (orderedIds.length === 0) {
    alert("対象の問題がありません。");
    return;
  }

  let nextId = null;

  if (firstRound) {
    // 1巡目：ID昇順に出題
    if (currentIdx >= orderedIds.length) {
      alert("全ての問題を1巡しました。最初から再開します。");
      currentIdx = 0;
      firstRound = false; // ここからは “出題回数が少ない問題優先” に切り替え
    } else {
      nextId = orderedIds[currentIdx++];
    }
  }

  if (!firstRound && !nextId) {
    // 2巡目以降：“最小出題回数”の問題を優先
    const counts = orderedIds.map(id => (questionHistory[id]?.count || 0));
    const minCount = Math.min(...counts);

    // currentIdx を起点に円環的にスキャンして minCount の問題を選ぶ
    const start = currentIdx % orderedIds.length;
    for (let i = 0; i < orderedIds.length; i++) {
      const idx = (start + i) % orderedIds.length;
      const id = orderedIds[idx];
      const c = questionHistory[id]?.count || 0;
      if (c === minCount) {
        nextId = id;
        currentIdx = (idx + 1) % orderedIds.length; // 次回の起点を少し進める
        break;
      }
    }

    // 念のための保険
    if (!nextId) {
      nextId = orderedIds[start];
      currentIdx = (start + 1) % orderedIds.length;
    }
  }

  // 表示
  const id = nextId ?? orderedIds[currentIdx++ % orderedIds.length];
  currentQuestion = questions[id];
  displayQuestion();
}

// ====== 問題表示 ======
function displayQuestion() {
  const q = currentQuestion;
  document.getElementById("question-container").innerText = q.question;

  // 選択肢：c1が"◯"なら c1,c2 のみ固定表示、そうでなければ c1〜c4 をシャッフル
  let choices = ["c1", "c2", "c3", "c4"];
  if (q.c1 === "◯") {
    choices = ["c1", "c2"];
  } else {
    choices = shuffle(choices);
  }

  const container = document.getElementById("choices-container");
  container.innerHTML = "";
  choices.forEach(key => {
    const text = q[key] || "[選択肢未設定]";
    const btn = document.createElement("button");
    btn.className = "choice-button";
    btn.dataset.key = key;
    btn.textContent = text;
    btn.onclick = () => handleAnswer(key, btn);
    container.appendChild(btn);
  });

  // フィードバック・自信度UIの初期状態
  document.getElementById("feedback").classList.add("hidden");
  document.getElementById("confidence-container").classList.add("hidden");

  // メモ復元
  const memoInput = document.getElementById("memo");
  memoInput.value = questionHistory[q.id]?.memo || "";

  // 既存のボタン群があれば削除してから再生成
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

  // NEXTボタン（初期は回答＆自信度未選択なので無効。過去に自信度があれば有効）
  const nextBtn = document.createElement("button");
  nextBtn.id = "next-btn";
  nextBtn.textContent = "Next";
  const saved = questionHistory[q.id];
  const savedConfidence = saved?.confidence;
  const savedCount = saved?.count || 0;
  nextBtn.disabled = !(savedConfidence && savedCount > 0);
  nextBtn.onclick = () => {
    const qid = q.id;
    if (!questionHistory[qid]) questionHistory[qid] = {};
    questionHistory[qid].memo = memoInput.value;
    saveResult();
    showNextQuestion(); // 次の出題選定は showNextQuestion() 側で
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

  document.getElementById("confidence-container").appendChild(controlContainer);

  // 自信度ボタンの初期表示（回答回数が0なら無色、>0なら保存値に色）
  document.querySelectorAll(".confidence").forEach(btn => {
    btn.classList.remove("selected");
    if (savedCount > 0 && btn.dataset.level === savedConfidence) {
      btn.classList.add("selected");
    }
  });
}

// ====== 回答処理（正誤表示 & 自信度必須） ======
function handleAnswer(selectedKey, button) {
  const isCorrect = selectedKey === currentQuestion.answer;

  // 選択肢ボタンの見た目＆無効化
  const buttons = document.querySelectorAll(".choice-button");
  buttons.forEach(btn => btn.disabled = true);
  buttons.forEach(btn => {
    if (btn.dataset.key === currentQuestion.answer) {
      btn.classList.add("correct");      // 正解は青
    } else if (btn === button && !isCorrect) {
      btn.classList.add("incorrect");    // 不正解の押下は赤
    }
  });

  // フィードバック表示 & 自信度UIを表示
  document.getElementById("feedback").classList.remove("hidden");
  document.getElementById("feedback").innerText = isCorrect ? "正解！" : "不正解！";
  document.getElementById("confidence-container").classList.remove("hidden");

  // 履歴更新（count増加、正誤）
  const qid = currentQuestion.id;
  if (!questionHistory[qid]) questionHistory[qid] = {};
  questionHistory[qid].correct = isCorrect;
  questionHistory[qid].count = (questionHistory[qid].count || 0) + 1;

  // 自信度未選択のままでは NEXT を押せない
  const nextBtn = document.getElementById("next-btn");
  nextBtn.disabled = true;

  // 自信度ボタン押下で色付け＆NEXT有効化
  document.querySelectorAll(".confidence").forEach(btn => {
    btn.onclick = () => {
      questionHistory[qid].confidence = btn.dataset.level;
      document.querySelectorAll(".confidence").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      nextBtn.disabled = false;
    };
  });
}

// ====== 成績保存 ======
function saveResult() {
  fetch(RESULT_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [currentUser]: questionHistory }),
  }).catch(e => console.warn("成績の保存に失敗:", e));
}

// ====== 選択肢のシャッフル（出題順は固定。選択肢だけシャッフルします） ======
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ====== 成績一覧 ======
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

  Object.keys(questionHistory).forEach(id => {
    const q = questions[id];
    const h = questionHistory[id];
    if (!q || !h) return;

    const tr = document.createElement("tr");
    [id, q.question, h.count || 0, h.correct ? 1 : 0, h.confidence || "", h.memo || ""].forEach(val => {
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

// 戻る（成績画面→出題画面）
function backToQuiz() {
  document.getElementById("score-screen").classList.add("hidden");
  document.getElementById("quiz-screen").classList.remove("hidden");
}
