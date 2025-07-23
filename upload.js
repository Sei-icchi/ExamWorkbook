const firebaseConfig = {
  apiKey: "AIzaSyDcWdByC9LIILR19LlAWAor_VtY2y47kUk",
  authDomain: "exampractice-d2ed3.firebaseapp.com",
  databaseURL: "https://exampractice-d2ed3-default-rtdb.firebaseio.com",
  projectId: "exampractice-d2ed3"
};

function uploadQuestions() {
  const data = document.getElementById("jsonInput").value;
  let questions;
  try {
    questions = JSON.parse(data);
  } catch (e) {
    document.getElementById("status").textContent = "JSONが不正です";
    return;
  }

  fetch(`${firebaseConfig.databaseURL}/questions.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(questions)
  })
  .then(res => {
    if (res.ok) {
      document.getElementById("status").textContent = "アップロード成功！";
    } else {
      document.getElementById("status").textContent = "アップロード失敗";
    }
  })
  .catch(err => {
    document.getElementById("status").textContent = "通信エラー";
    console.error(err);
  });
}
