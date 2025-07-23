// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyDcWdByC9LIILR19LlAWAor_VtY2y47kUk",
  authDomain: "exampractice-d2ed3.firebaseapp.com",
  databaseURL: "https://exampractice-d2ed3-default-rtdb.firebaseio.com",
  projectId: "exampractice-d2ed3",
};

const dbURL = firebaseConfig.databaseURL;

// DOM要素
const startScreen = document.getElementById("start-screen");
const quizScreen = document.getElementById("quiz-screen");
const resultScreen = document.getElementById("result-screen");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const questionText = document.getElementById("question-text");
const choicesDiv = document.getElementById("choices");
const feedbackDiv = document.getElementById("feedback");
const resultSummary = document.getElementById("result-summary");

let username = "";
let selectedGenres = [];
let questionCount = 5;
let questions = [];
let currentQuestionIndex = 0;
let score = { correct: 0, incorrect: 0 };

// 問題データ取得（Firebase）
async function loadQuestions() {
  try {
    const res = await fetch(`${dbURL}/questions.json`);
    const data = await res.json();
    return Object.values(data);
  } catch (e) {
    console.error("Firebaseから問題取得失敗:", e);
    return [];
  }
}

// 成績保存
async function saveResult(questionId, isCorrect, confidence) {
  const timestamp = Date.now();
  const result = {
    username,
    questionId,
    correct: isCorrect,
    confidence,
    timestamp
  };
  await fetch(`${dbURL}/users.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result)
  });
}

// 出題
function showQuestion() {
  if (currentQuestionIndex >= questions.length) {
    showResult();
    return;
  }
  const q = questions[currentQuestionIndex];
  questionText.textContent = q.text;

  // 選択肢シャッフル
  const shuffledChoices = [...q.choices].sort(() => Math.random() - 0.5);
  choicesDiv.innerHTML = "";
  shuffledChoices.forEach(choice => {
    const btn = document.createElement("button");
    btn.textContent = choice;
    btn.onclick = () => handleAnswer(choice === q.answer, q.id);
    choicesDiv.appendChild(btn);
  });
  feedbackDiv.textContent = "";
}

function handleAnswer(isCorrect, questionId) {
  feedbackDiv.textContent = isCorrect ? "✅ 正解！" : "❌ 不正解…";
  if (isCorrect) score.correct++;
  else score.incorrect++;

  document.querySelectorAll(".confidence-btn").forEach(btn => {
    btn.onclick = () => {
      saveResult(questionId, isCorrect, btn.dataset.level);
      currentQuestionIndex++;
      showQuestion();
    };
  });
}

function showResult() {
  resultSummary.textContent = `${username}さんの成績: 正解 ${score.correct}, 不正解 ${score.incorrect}`;
  quizScreen.classList.remove("active");
  resultScreen.classList.add("active");
}

// 開始
startBtn.onclick = async () => {
  username = document.getElementById("username").value.trim();
  if (!username) return alert("ユーザー名を入力してください");

  selectedGenres = Array.from(document.querySelectorAll("#start-screen input[type=checkbox]:checked"))
    .map(cb => cb.value);
  if (selectedGenres.length === 0) return alert("ジャンルを1つ以上選択してください");

  const countValue = document.getElementById("question-count").value;
  questionCount = countValue === "all" ? Infinity : parseInt(countValue);

  const allQuestions = await loadQuestions();
  questions = allQuestions
    .filter(q => selectedGenres.includes(q.genre))
    .sort(() => Math.random() - 0.5)
    .slice(0, questionCount);

  currentQuestionIndex = 0;
  score = { correct: 0, incorrect: 0 };
  startScreen.classList.remove("active");
  quizScreen.classList.add("active");
  showQuestion();
};

restartBtn.onclick = () => {
  resultScreen.classList.remove("active");
  startScreen.classList.add("active");
};
