const firebaseConfig = {
  apiKey: "AIzaSyDcWdByC9LIILR19LlAWAor_VtY2y47kUk",
  authDomain: "exampractice-d2ed3.firebaseapp.com",
  databaseURL: "https://exampractice-d2ed3-default-rtdb.firebaseio.com",
  projectId: "exampractice-d2ed3"
};

let questions = [];
let currentIndex = 0;
let correctCount = 0;
let userAnswers = [];
let currentUser = "";

document.getElementById("start-btn").addEventListener("click", startQuiz);

function startQuiz() {
  currentUser = document.getElementById("username").value.trim();
  if (!currentUser) {
    alert("ユーザー名を入力してください");
    return;
  }

  const genres = [...document.querySelectorAll("#genre-selection input:checked")].map(cb => cb.value);
  if (genres.length === 0) {
    alert("ジャンルを選んでください");
    return;
  }

  fetch(`${firebaseConfig.databaseURL}/questions.json`)
    .then(res => res.json())
    .then(data => {
      questions = Object.values(data).filter(q => genres.includes(q.genre));
      const count = document.getElementById("question-count").value;
      if (count !== "all") {
        questions = questions.slice(0, count === "mistakes" ? 5 : parseInt(count));
      }

      if (questions.length === 0) {
        alert("選択したジャンルに問題がありません");
        return;
      }

      questions = shuffle(questions);
      document.getElementById("start-screen").classList.add("hidden");
      document.getElementById("quiz-screen").classList.remove("hidden");
      showQuestion();
    });
}

function showQuestion() {
  const q = questions[currentIndex];
  document.getElementById("question-text").textContent = q.question;
  const choices = shuffle([...q.choices]);
  const choiceContainer = document.getElementById("choices");
  choiceContainer.innerHTML = "";

  choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.textContent = choice;
    btn.onclick = () => {
      const result = document.getElementById("result");
      result.textContent = (choice === q.answer) ? "正解！" : `不正解… 正解は「${q.answer}」`;
      if (choice === q.answer) correctCount++;
      userAnswers.push({ questionId: q.id, correct: choice === q.answer });
      document.getElementById("confidence-container").classList.remove("hidden");
    };
    choiceContainer.appendChild(btn);
  });
}

document.querySelectorAll(".confidence-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const confidence = btn.dataset.level;
    const record = userAnswers[currentIndex];
    record.confidence = confidence;

    fetch(`${firebaseConfig.databaseURL}/users/${currentUser}/${record.questionId}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    });

    currentIndex++;
    document.getElementById("confidence-container").classList.add("hidden");
    document.getElementById("result").textContent = "";

    if (currentIndex < questions.length) {
      showQuestion();
    } else {
      showResult();
    }
  });
});

function showResult() {
  document.getElementById("quiz-screen").classList.add("hidden");
  document.getElementById("result-screen").classList.remove("hidden");
  document.getElementById("final-score").textContent = `${questions.length}問中 ${correctCount}問正解`;
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}
