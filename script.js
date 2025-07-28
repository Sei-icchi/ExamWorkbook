// Firebase 初期化
const firebaseConfig = {
  apiKey: "AIzaSyDcWdByC9LIILR19LlAWAor_VtY2y47kUk",
  authDomain: "exampractice-d2ed3.firebaseapp.com",
  databaseURL: "https://exampractice-d2ed3-default-rtdb.firebaseio.com",
  projectId: "exampractice-d2ed3",
  storageBucket: "exampractice-d2ed3.firebasestorage.app",
  messagingSenderId: "1074116776847",
  appId: "1:1074116776847:web:b86f8817c4c15b31f571fa",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ユーザー名取得
let userName = localStorage.getItem("userName") || prompt("ユーザー名を入力してください");
localStorage.setItem("userName", userName);

let allQuestions = {};
let usedIds = new Set();

// 問題読み込み
function loadQuestions() {
  db.ref("questions").once("value", snapshot => {
    allQuestions = snapshot.val() || {};
    startQuiz();
  });
}

// ユーザーの成績取得
function getUserResults(callback) {
  db.ref("users/" + userName).once("value", snapshot => {
    const results = snapshot.val() || {};
    callback(results);
  });
}

// クイズ開始
function startQuiz() {
  getUserResults(userResults => {
    const unshown = Object.keys(allQuestions).filter(qid => !(qid in userResults));
    let currentId;

    if (unshown.length > 0) {
      currentId = unshown[Math.floor(Math.random() * unshown.length)];
    } else {
      const allIds = Object.keys(allQuestions);
      currentId = allIds[Math.floor(Math.random() * allIds.length)];
    }

    showQuestion(allQuestions[currentId]);
  });
}

// 問題表示
function showQuestion(q) {
  const questionText = document.getElementById("question-text");
  const choicesDiv = document.getElementById("choices");

  questionText.innerText = q.question;
  choicesDiv.innerHTML = "";

  ["C1", "C2", "C3", "C4"].forEach(choiceKey => {
    const btn = document.createElement("button");
    btn.innerText = q[choiceKey];
    btn.className = "choice-button";
    btn.onclick = () => checkAnswer(q, q[choiceKey]);
    choicesDiv.appendChild(btn);
  });
}

// 答えを確認
function checkAnswer(q, selected) {
  const isCorrect = selected === q.answer;

  // 結果保存
  db.ref(`users/${userName}/${q.id}`).set({
    correct: isCorrect,
    selected: selected
  });

  alert(isCorrect ? "正解！" : `不正解！ 正解は: ${q.answer}`);
  startQuiz();
}

window.onload = loadQuestions;
