const firebaseConfig = {
  databaseURL: "https://exampractice-d2ed3.firebaseio.com"
};

fetch(`${firebaseConfig.databaseURL}/users.json`)
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById("results");
    for (const user in data) {
      const div = document.createElement("div");
      div.innerHTML = `<h3>${user}</h3><ul>` +
        Object.entries(data[user]).map(([qid, entry]) =>
          `<li>Q${qid} - ${entry.correct ? "○" : "×"} (${entry.confidence})</li>`
        ).join("") + "</ul>";
      container.appendChild(div);
    }
  });
