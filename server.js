// Description: A simple Node.js server using Groq API to generate financial summaries.
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { OpenAI } from "openai";
import dotenv from "dotenv";
dotenv.config();


const app = express();
app.use(cors({
  origin: "https://financial-dashboard-six-iota.vercel.app", // ✅ your Vercel domain
  credentials: true
}));
app.use(express.json());

// ✅ Connect to MongoDB**mongodb+srv://rajesh:rajesh%40123@expenses.fgkd1jt.mongodb.net/expensesDB?retryWrites=true&w=majority&appName=expenses
mongoose.connect("process.env.MONGO_URI ", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("✅ Connected to MongoDB Atlas");
}).catch((err) => {
  console.error("❌ MongoDB connection error:", err);
});



// ✅ Expense Schema
const expenseSchema = new mongoose.Schema({
  amount: Number,
  category: String,
  date: String,
  userId: String
});
const Expense = mongoose.model("Expense", expenseSchema);

// ✅ Groq (OpenAI-compatible) setup
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY, // 🟢 Your actual Groq API key
  baseURL: "https://api.groq.com/openai/v1"         // 🟢 Required for Groq to mimic OpenAI
});
// ✅ Prompt builder
function buildPrompt(summary) {
  const { username, totalSpent, topCategory, categoryBreakdown } = summary;
  let breakdownText = "";

  for (const [cat, amount] of Object.entries(categoryBreakdown)) {
    const percent = ((amount / totalSpent) * 100).toFixed(1);
    breakdownText += `• ${cat}: ₹${amount} (${percent}%)\n`;
  }

  return `
You are a helpful financial assistant.

Here is the user’s complete expense summary:
- Total Spent: ₹${totalSpent}
- Top Spending Category: ${topCategory}
- Category Breakdown:
${breakdownText}

Greet the user with their ${username} and write a short, friendly, personalized financial summary and suggestion based on this user's spending behavior,
give suggestion to user to save money and be more financially responsible.Just give a short summary and suggestion, no need to be too detailed.
`;
}

// ✅ Save Expense
app.post("/api/expenses", async (req, res) => {
  try {
    const expense = new Expense(req.body);
    await expense.save();
    res.status(201).json({ message: "✅ Expense saved successfully." });
  } catch (err) {
    console.error("❌ Error saving expense:", err);
    res.status(500).json({ error: "❌ Error saving expense." });
  }
});

// ✅ Get Expenses
app.get("/api/expenses", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    const expenses = await Expense.find({ userId }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    console.error("❌ Fetch error:", err);
    res.status(500).json({ error: "❌ Failed to fetch expenses." });
  }
});

// ✅ Delete Expense
app.delete("/api/expenses/:id", async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ message: "✅ Expense deleted." });
  } catch (err) {
    console.error("❌ Delete error:", err);
    res.status(500).json({ error: "❌ Failed to delete expense." });
  }
});

// ✅ Generate Insight using Groq's Mixtral
app.post("/generate-insight", async (req, res) => {
  try {
    const { userId, username } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const expenses = await Expense.find({ userId });
    if (expenses.length === 0) return res.json({ insight: "No expenses found for this user." });

    const categoryTotals = {};
    let totalSpent = 0;

    expenses.forEach(e => {
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

    const summary = { username,totalSpent, topCategory, categoryBreakdown: categoryTotals };
    const prompt = buildPrompt(summary);

    const response = await openai.chat.completions.create({
      model: "mistral-saba-24b", // 🧠 Groq's fastest model
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    });

    const insight = response.choices?.[0]?.message?.content || "No insight generated.";
    res.json({ insight });

  } catch (err) {
    console.error("❌ Insight Error:", err);
    res.status(500).json({ error: "❌ Failed to generate insight." });
  }
});

// ✅ Start Server
app.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});
