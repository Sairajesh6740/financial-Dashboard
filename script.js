// Initialize Firebase
const firebaseConfig = {
      apiKey: "AIzaSyDH06GmuMFz-ZNYWTwgnPAcodz6-_zDDIA",
      authDomain: "financialdashboardanalysis.firebaseapp.com",
      projectId: "financialdashboardanalysis",
      storageBucket: "financialdashboardanalysis.appspot.com",
      messagingSenderId: "433992335630",
      appId: "1:433992335630:web:8362255f9acd44b740175f"
    };
    if (firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();
    
   // defined at the top level, globally
   async function fetchExpensesFromMongoDB() {
  const user = firebase.auth().currentUser;

  if (!user) return;

  try {
    const res = await fetch(`https://financial-dashboard-y0nx.onrender.com/api/expenses?userId=${user.uid}`);
    const data = await res.json();
    expenses = data;
    console.log("📦 MongoDB Expenses Fetched →", expenses);
    updateUI();
    updateChart();         // Category-wise Pie Chart
    updateMonthlyChart();  // Monthly Line Chart
  } catch (err) {
    console.error("❌ Failed to fetch expenses from MongoDB:", err);
  }
}

firebase.auth().onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    document.getElementById("loader").style.display = "none";
    document.getElementById("username").textContent = user.displayName || user.email;
    await fetchExpensesFromMongoDB(); // ✅ Now using MongoDB only
    showMessages(user.displayName || user.email); // ✅ Optional
  }
});

    
    // Initialize local storage variables    
    let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
    let income = parseFloat(localStorage.getItem("income")) || 0;
    let goal = parseFloat(localStorage.getItem("goal")) || 0;
    let editingIndex = -1;
    
    let categoryChart;
    let monthlyChart;
    
  function saveToStorage() {
    localStorage.setItem("expenses", JSON.stringify(expenses));
    localStorage.setItem("income", income);
    localStorage.setItem("goal", goal);
    localStorage.setItem("username", firebase.auth().currentUser?.displayName || "User");
  }
  let editingId = null;

async function addExpense() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const amount = parseFloat(document.getElementById("expenseInput").value);
  const category = document.getElementById("categoryInput").value;
  let date = document.getElementById("dateInput").value;

  if (!date) {
    date = new Date().toISOString().split("T")[0];
    document.getElementById("dateInput").value = date;
  }

  const expense = {
    amount,
    category,
    date,
    userId: user.uid,
  };

  try {
    const response = await fetch("https://financial-dashboard-y0nx.onrender.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expense),
    });

    const data = await response.json();
    if (data.message) {
      alert("✅ Expense saved to MongoDB!");
      clearForm(); // Optional
      await fetchExpensesFromMongoDB(); // 🟢 IMPORTANT: Refresh UI & expense list
    } else {
      alert("❌ Failed to save expense.");
    }
  } catch (err) {
    alert("Failed to add expense: " + err.message);
  }
}

function clearForm() {
  document.getElementById("expenseInput").value = "";
  document.getElementById("categoryInput").value = "";
  document.getElementById("dateInput").value = "";
}

  function setIncome() {
    const val = parseFloat(document.getElementById("incomeInput").value);
    if (!val) return alert("Please enter a valid income.");
    income = val;
    saveToStorage();
    updateUI();
  }

  function calculateBalance() {
    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const balance = income - total;
    document.getElementById("balance").textContent = `₹${balance}`;
  }

  function setGoal() {
    const val = parseFloat(document.getElementById("goalInput").value);
    if (!val) return alert("Please enter a valid goal.");
    goal = val;
    saveToStorage();
    updateUI();
  }

  function resetDashboard() {
    if (confirm("Reset all data?")) {
      localStorage.clear();
      expenses = [];
      income = 0;
      goal = 0;
      editingIndex = -1;
      updateUI();
    }
  }

  function updateUI() {
  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const balance = income - totalExpense;
  document.getElementById("balance").textContent = `₹${balance}`;
  document.getElementById("summary").textContent = `Expenses: ₹${totalExpense} | Transactions: ${expenses.length}`;

  const list = document.getElementById("expensesList");
  list.innerHTML = "";
  expenses.forEach((e, i) => {
    const div = document.createElement("div");
    div.className = "expense-item";
    div.innerHTML = `
      ₹${e.amount} - ${e.category} - ${e.date}
      <button class="edit-button" onclick="editExpense(${i})">✏️</button>
      <button class="delete-button" onclick="deleteExpense(${i})">🗑️</button>`;
    list.appendChild(div);
  });

  const status = document.getElementById("goalStatus");
  const progressBar = document.getElementById("progressBar");
  if (goal > 0) {
    const saved = income - totalExpense;
    const percent = Math.min(100, Math.round((saved / goal) * 100));
    progressBar.style.width = percent + "%";
    progressBar.textContent = percent + "%";
    status.innerHTML = `Saved ₹${saved} of ₹${goal}`;
  } else {
    progressBar.style.width = "0%";
    progressBar.textContent = "0%";
    status.innerHTML = "";
  }

  updateChart();
  updateMonthlyChart();
  // ❌ Removed: populateMonthSelector(); (not needed)
}


function editExpense(index) {
  const expense = expenses[index];
  if (!expense) return;

  document.getElementById("expenseInput").value = expense.amount;
  document.getElementById("categoryInput").value = expense.category;
  document.getElementById("dateInput").value = expense.date || "";

  editingId = expense._id;  // Save MongoDB ID for update use
}

async function deleteExpense(index) {
  const expense = expenses[index];
  if (!expense || !expense._id) return;

  const confirmDelete = confirm("Delete this expense?");
  if (!confirmDelete) return;

  try {
    const res = await fetch(`https://financial-dashboard-y0nx.onrender.com/api/expenses/${expense._id}`, {
      method: "DELETE"
    });

    const data = await res.json();
    alert(data.message || "Expense deleted");

    // 🟢 Re-fetch latest data from MongoDB
    await fetchExpensesFromMongoDB();  // << MOST IMPORTANT
  } catch (err) {
    console.error("❌ Delete failed:", err);
    alert("❌ Failed to delete expense.");
  }
}


function filterExpenses() {
  const category = document.getElementById("filterCategory").value;
  const list = document.getElementById("expensesList");
  list.innerHTML = "";

  const filtered = category === "All"
    ? expenses
    : expenses.filter(e => e.category === category);

  filtered.forEach((e, i) => {
    const div = document.createElement("div");
    div.className = "expense-item";
    div.innerHTML = `
      ₹${e.amount} - ${e.category} - ${e.date}
      <button class="edit-button" onclick="editExpense(${i})">✏️</button>
      <button class="delete-button" onclick="deleteExpense(${i})">🗑️</button>`;
    list.appendChild(div);
  });
}


  function exportCSV() {
    if (!expenses.length) return alert("No data to export.");
    let csv = "Amount,Category,Date\n";
    expenses.forEach(e => {
      csv += `${e.amount},${e.category},${e.date}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expenses.csv";
    a.click();
  }

function updateChart() {
  const ctx = document.getElementById("expenseChart").getContext("2d");

  const categoryTotals = {};
  expenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + Number(e.amount);
  });

  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);

  if (categoryChart) categoryChart.destroy();

  categoryChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        label: "Category Breakdown",
        data,
        backgroundColor: [
          "#FF6384", "#36A2EB", "#FFCE56",
          "#4BC0C0", "#9966FF", "#FF9F40"
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: document.body.classList.contains("dark") ? "#fff" : "#000"
          }
        }
      }
    }
  });

  updateChartTheme(); // 🌙 Optional: For dark/light mode adaptation
}



function updateMonthlyChart() {
  const monthlyTotals = {};

  expenses.forEach(e => {
    if (!e.date) return;
    const month = e.date.slice(0, 7); // "YYYY-MM"
    monthlyTotals[month] = (monthlyTotals[month] || 0) + Number(e.amount);
  });

  const labels = Object.keys(monthlyTotals).sort();
  const data = labels.map(month => monthlyTotals[month]);

  if (monthlyChart) monthlyChart.destroy();

  const ctx = document.getElementById('monthlyChart').getContext('2d');
  monthlyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Monthly Expenses',
        data,
        backgroundColor: 'rgba(54,162,235,0.2)',
        borderColor: 'rgba(54,162,235,1)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointRadius: 5,
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

   function toggleDarkMode() {
      document.body.classList.toggle("dark");
      updateChartTheme();
    }

function updateChartTheme() {
  const isDark = document.body.classList.contains("dark");
  const textColor = isDark ? '#fff' : '#000';

  if (categoryChart) {
    categoryChart.options.plugins.legend.labels.color = textColor;
    categoryChart.options.scales = {
      ...(categoryChart.options.scales || {}),
      x: { ticks: { color: textColor } },
      y: { ticks: { color: textColor } }
    };
    categoryChart.update();
  }

  if (monthlyChart) {
    monthlyChart.options.plugins = {
      ...(monthlyChart.options.plugins || {}),
      legend: {
        ...(monthlyChart.options.plugins?.legend || {}),
        labels: {
          ...(monthlyChart.options.plugins?.legend?.labels || {}),
          color: textColor
        }
      }
    };
    monthlyChart.options.scales = {
      x: { ticks: { color: textColor } },
      y: { ticks: { color: textColor } }
    };
    monthlyChart.update();
  }
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "🌞 Good Morning";
  if (hour < 18) return "🌤️ Good Afternoon";
  return "🌙 Good Evening";
}

function showMessages(username) {
  const welcomeDiv = document.getElementById("welcome");

  // Step 1: Show welcome back
  welcomeDiv.textContent = `👋 Welcome back, ${username}!`;
  welcomeDiv.classList.add("typing");

  // Step 2: After 3 seconds, show greeting
  setTimeout(() => {
    welcomeDiv.classList.remove("typing");
    welcomeDiv.classList.add("fade-out");

    setTimeout(() => {
      welcomeDiv.classList.remove("fade-out");
      welcomeDiv.classList.add("typing");
      welcomeDiv.textContent = `${getGreeting()}, ${username}!`;
    }, 1000);
  }, 3000);
}



    // Firebase Logout function
    function logout() {
      firebase.auth().signOut().then(() => {
        alert("Logged out successfully!");
        window.location.href = "login.html"; // redirect to login page
      }).catch(error => {
        alert("Logout error: " + error.message);
      });
    }
//*************************************************************************************** */
// Function to prepare today's expense summary
// Returns null if no expenses for today
function prepareTodaysExpenseSummary(expenses) {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const todayExpenses = expenses.filter(e => e.date === today);

  console.log("Today (from system):", today);
  console.log("All Expenses:", expenses);
  console.log("Filtered Today's Expenses:", todayExpenses);

  if (todayExpenses.length === 0) return null;

  const categoryTotals = {};
  let totalSpent = 0;

  todayExpenses.forEach(e => {
    const amount = Number(e.amount);
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + amount;
    totalSpent += amount;
  });

  let topCategory = "";
  let topAmount = 0;
  for (const [category, amount] of Object.entries(categoryTotals)) {
    if (amount > topAmount) {
      topAmount = amount;
      topCategory = category;
    }
  }

  return {
    totalSpent,
    topCategory,
    categoryBreakdown: categoryTotals
  };
}


async function getTodaysExpensesFromFirebase() {
  const user = firebase.auth().currentUser;
  if (!user) return [];

  const today = new Date().toISOString().split("T")[0];
  const snapshot = await db.collection("users").doc(user.uid).collection("expenses")
    .where("date", "==", today)
    .get();

  const expenses = [];
  snapshot.forEach(doc => {
    expenses.push(doc.data());
  });

  console.log("📦 Firebase: Today's Expenses →", expenses);
  return expenses;
}
async function getTodaysExpensesFromMongoDB() {
  const user = firebase.auth().currentUser;
  if (!user) return [];

  const today = new Date().toISOString().split("T")[0];
  try {
    const response = await fetch(`https://financial-dashboard-y0nx.onrender.com/api/expenses?userId=${user.uid}`);
    const allExpenses = await response.json();
    const todayExpenses = allExpenses.filter(e => e.date === today);

    console.log("📦 MongoDB: Today's Expenses →", todayExpenses);
    return todayExpenses;
  } catch (err) {
    console.error("❌ Failed to fetch today’s expenses:", err);
    return [];
  }
}
async function fetchAllExpensesFromMongoDB() {
  const user = firebase.auth().currentUser;
  if (!user) return [];

  try {
    const res = await fetch(`https://financial-dashboard-y0nx.onrender.com/api/expenses?userId=${user.uid}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("❌ Failed to fetch all expenses:", err);
    return [];
  }
}


async function generateAndShowDailyInsight() {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("User not logged in!");
    return;
  }

  const insightBox = document.getElementById("dailyInsightText");
  insightBox.textContent = "⏳ Generating insight...";

  try {
    const response = await fetch("https://financial-dashboard-y0nx.onrender.com/generate-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.uid, username: user.displayName || user.email || "User" })
    });

    const data = await response.json();

    if (data.insight) {
      insightBox.textContent = `${data.insight}`;
    } else {
      insightBox.textContent = "❌ No insight received from server.";
    }

  } catch (error) {
    console.error("❌ Insight fetch error:", error);
    insightBox.textContent = "❌ Failed to generate insight. Check your server.";
  }
}



console.log("🧾 Sending userId:", firebase.auth().currentUser?.uid);



async function addExpenseToDB(expense) {
  await fetch("https://financial-dashboard-y0nx.onrender.com/api/expenses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(expense)
  });
}







  // Initialize dashboard on load
  window.onload = updateUI;
  
 