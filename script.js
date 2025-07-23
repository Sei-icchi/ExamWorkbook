// 成績保存（ユーザー名階層構造）
async function saveResult(questionId, isCorrect, confidence) {
  const result = {
    correct: isCorrect,
    confidence: confidence
  };

  await fetch(`${dbURL}/users/${username}/${questionId}.json`, {
    method: "PUT",
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

  const shuffledChoices = [...q.choices].sort(() => Math.random() - 0.5);
  choicesDiv.innerHTML = "";
  shuffledChoices.forEach(choice => {
    const btn = document.createElement("button");
    btn.textContent = choice;
    btn.onclick = () => handleAnswer(choice === q.answer, q.id);
    choicesDiv.appendChild(btn);
  });
  feedbackDiv.textContent = "";
  document.getElementById("confidence-section").style.display = "none";
}

function handleAnswer(isCorrect, questionId) {
  feedbackDiv.textContent = isCorrect ? "✅ 正解！" : "❌ 不正解…";
  if (isCorrect) score.correct++;
  else score.incorrect++;

  // 自信度セクション表示
  document.getElementById("confidence-section").style.display = "block";

  document.querySelectorAll(".confidence-btn").forEach(btn => {
    btn.onclick = async () => {
      await saveResult(questionId, isCorrect, btn.dataset.level);
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

// ユーザー成績一覧表示
document.getElementById("view-user-results").onclick = async () => {
  const res = await fetch(`${dbURL}/users/${username}.json`);
  const data = await res.json();
  const userResultsDiv = document.getElementById("user-results");
  userResultsDiv.innerHTML = `<h3>${username}さんの全成績</h3>`;
  for (const [qid, result] of Object.entries(data)) {
    userResultsDiv.innerHTML += `<p>問題ID: ${qid}, 正解: ${result.correct ? "○" : "×"}, 自信度: ${result.confidence}</p>`;
  }
  userResultsDiv.style.display = "block";
};

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
  document.getElementById("user-results").style.display = "none";
};
