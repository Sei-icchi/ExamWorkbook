const firebaseConfig = {
  apiKey: "AIzaSyDcWdByC9LIILR19LlAWAor_VtY2y47kUk",
  authDomain: "exampractice-d2ed3.firebaseapp.com",
  databaseURL: "https://exampractice-d2ed3-default-rtdb.firebaseio.com",
  projectId: "exampractice-d2ed3",
};

const dbUrl = firebaseConfig.databaseURL;

let user = "";
let allQuestions = {};
let selectedQuestions = [];
let currentQuestionIndex = 0;
let selectedGenres = [];
let selectedCount = "5";
let userProgress = {}; // 保存データ

const startButton = document.getElementById("start-button");
const quizScreen = document.getElementById("quiz-screen");
const startScreen = document.getElementById("start-screen");
const questionText = document.getElementById("question-text");
const choicesDiv = document.getElementById("choices");
const feedbackDiv = document.getElementById("feedback");
const confidenceSection = document.getElementById("confidence-section");
const memoArea = document.getElementById("memo");
const nextButton = document.getElementById("next-button");

startButton.addEventListener("click", async () => {
  user = document.getElementById("username").value.trim();
  if (!user) return alert("ユーザー名を入力してください。");

  selectedGenres = Array.from(document.querySelectorAll("#start-screen input[type=checkbox]:checked")).map(e => e.value);
  if (selectedGenres.length === 0) return alert("ジャンルを1つ以上選択してください。");

  selectedCount = document.getElementById("question-count").value;

  await fetchQuestions();
  loadUserProgress();
  selectQuestions();
  showQuestion();
  startScreen.classList.add("hidden");
  quizScreen.classList.remove("hidden");
});

async function fetchQuestions() {
  const res = await fetch(`${dbUrl}/questions.json`);
  const data = await res.json();
  allQuestions = data;
}

function loadUserProgress() {
  // fetch user data
  fetch(`${dbUrl}/results/${user}.json`)
    .then(res => res.json())
    .then(data => {
      if (data) userProgress = data;
    });
}

function selectQuestions() {
  const filtered = Object.values(allQuestions).filter(q => selectedGenres.includes(q.genre));
  const unused = filtered.filter(q => !userProgress[q.id]);
  const sorted = unused.length ? unused : filtered;

  const count = selectedCount === "all" ? sorted.length : (selectedCount === "wrong" ? 999 : parseInt(selectedCount));
  shuffleArray(sorted);
  selectedQuestions = sorted.slice(0, count);
  currentQuestionIndex = 0;
}

function showQuestion() {
  confidenceSection.classList.add("hidden");
  feedbackDiv.classList.add("hidden");
  feedbackDiv.textContent = "";

  const q = selectedQuestions[currentQuestionIndex];
  questionText.textContent = q.question;

  const options = [q.C1, q.C2, q.C3, q.C4];
  const answer = q.answer;

  let isShuffle = q.C1 !== "◯";
  const choices = isShuffle ? shuffleArray([...options]) : options;

  choicesDiv.innerHTML = "";
  choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.textContent = choice;
    btn.onclick = () => handleAnswer(choice, answer, q);
    choicesDiv.appendChild(btn);
  });
}

function handleAnswer(choice, answer, q) {
  const isCorrect = choice === answer;
  feedbackDiv.textContent = isCorrect ? "◯ 正解！" : "✗ 不正解！";
  feedbackDiv.className = isCorrect ? "correct" : "incorrect";
  feedbackDiv.classList.remove("hidden");
  confidenceSection.classList.remove("hidden");
  memoArea.value = userProgress[q.id]?.memo || "";
  document.querySelectorAll(".confidence").forEach(btn => {
    btn.classList.remove("selected");
    if (btn.dataset.level === userProgress[q.id]?.confidence) {
      btn.classList.add("selected");
    }
  });
  saveResult(q.id, isCorrect);
}

function saveResult(id, correct) {
  if (!userProgress[id]) userProgress[id] = { correct: 0, wrong: 0 };
  if (correct) userProgress[id].correct++;
  else userProgress[id].wrong++;
}

document.querySelectorAll(".confidence").forEach(btn => {
  btn.addEventListener("click", () => {
    const level = btn.dataset.level;
    const qid = selectedQuestions[currentQuestionIndex].id;
    userProgress[qid].confidence = level;
    document.querySelectorAll(".confidence").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
  });
});

nextButton.addEventListener("click", () => {
  const qid = selectedQuestions[currentQuestionIndex].id;
  userProgress[qid].memo = memoArea.value;

  // Save to Firebase
  fetch(`${dbUrl}/results/${user}/${qid}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userProgress[qid])
  });

  currentQuestionIndex++;
  if (currentQuestionIndex < selectedQuestions.length) {
    showQuestion();
  } else {
    alert("クイズ終了！");
    location.reload();
  }
});

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
