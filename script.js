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
let currentMode = "all";
let questionHistory = {};

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

  currentMode = document.getElementById("mode-select").value;

  const res = await fetch(RESULT_URL);
  const data = await res.json();
  if (data && data[currentUser]) {
    questionHistory = data[currentUser];
  }

  const qRes = await fetch(DB_URL);
  questions = await qRes.json();

  document.getElementById("start-screen").classList.add("hidden");
  document.getElementById("quiz-screen").classList.remove("hidden");
  showNextQuestion();
});

function showNextQuestion() {
  let candidates = Object.values(questions).filter(q => currentGenre.includes(q.genre));

  if (currentMode === "unanswered") {
    candidates.sort((a, b) => {
      const aCount = questionHistory[a.id]?.count || 0;
      const bCount = questionHistory[b.id]?.count || 0;
      return aCount - bCount;
    });
  } else if (currentMode === "incorrect") {
    candidates = candidates.filter(q => questionHistory[q.id]?.correct === false);
  }

  if (candidates.length === 0) {
    alert("対象の問題がありません。");
    return;
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  currentQuestion = candidates[randomIndex];
  displayQuestion();
}

function displayQuestion() {
  const q = currentQuestion;
  document.getElementById("question-container").innerText = q.question;

  let choices = ["c1", "c2", "c3", "c4"];
  if (q.c1 === "◯") {
    choices = ["c1", "c2"];
  }

  const displayChoices = (q.c1 === "◯") ? choices : shuffle(choices);

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

  document.getElementById("feedback").classList.add("hidden");
  document.getElementById("confidence-container").classList.add("hidden");
  document.getElementById("memo").value = questionHistory[q.id]?.memo || "";

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
  nextBtn.disabled = true;
  nextBtn.onclick = () => {
    questionHistory[currentQuestion.id].memo = document.getElementById("memo").value;
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

  if (!questionHistory[currentQuestion.id]) {
    questionHistory[currentQuestion.id] = {};
  }
  questionHistory[currentQuestion.id].correct = isCorrect;
  questionHistory[currentQuestion.id].count = (questionHistory[currentQuestion.id].count || 0) + 1;

  document.querySelectorAll(".confidence").forEach(btn => {
    btn.onclick = () => {
      questionHistory[currentQuestion.id].confidence = btn.dataset.level;
    };
  });


document.querySelectorAll(".confidence").forEach(btn => {
  btn.onclick = () => {
    questionHistory[currentQuestion.id].confidence = btn.dataset.level;

    // すべての自信度ボタンの selected を外す
    document.querySelectorAll(".confidence").forEach(b => b.classList.remove("selected"));
    // 押したボタンだけ selected にする
    btn.classList.add("selected");

    // NEXTボタンを有効にする
    document.getElementById("next-btn").disabled = false;
  };
});




}

function saveResult() {
  fetch(RESULT_URL, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ [currentUser]: questionHistory }),
  });
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}



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

function backToQuiz() {
  document.getElementById("score-screen").classList.add("hidden");
  document.getElementById("quiz-screen").classList.remove("hidden");
}
