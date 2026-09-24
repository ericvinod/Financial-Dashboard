// ---- Connection settings -------------------------------------------------
// These point the app at your project's data store. Nothing about them is
// shown in the interface — the app only ever talks about "your data".
const DB_URL = "https://ayxmhtojfwdcuodxmlzm.supabase.co";
const DB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5eG1odG9qZndkY3VvZHhtbHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5ODAxMDgsImV4cCI6MjEwNTU1NjEwOH0.C8XHDltPKBcYfFkloNfY9H_6gwRcblmZRBOj4luiyXc";

const db = window.supabase.createClient(DB_URL, DB_KEY);

// ---- Fixed vocabularies ----------------------------------------------------
const CATEGORIES = [
  "Parents Expenses", "Home Expenses", "Home Loan EMI", "Milk", "Non-veg",
  "Rachael", "Petrol", "Vegetable and Groceries", "Mobile", "WiFi", "NOT Budgeted"
];

const PAID_BY = ["Cash/GPAY", "Amazon Pay ICICI", "SBI", "HDFC Swiggy", "Others"];

// Category colors, carried over from the original tracker's color-coding
// and extended so every category has its own distinct color.
const CATEGORY_COLORS = {
  "Parents Expenses": "#00B0F0",
  "Home Expenses": "#C00000",
  "Home Loan EMI": "#1F4E79",
  "Milk": "#BDD7EE",
  "Non-veg": "#92D050",
  "Rachael": "#FF6FB0",
  "Petrol": "#7030A0",
  "Vegetable and Groceries": "#FFC000",
  "Mobile": "#FFEB3B",
  "WiFi": "#00B050",
  "NOT Budgeted": "#8892A0"
};

const PAID_BY_COLORS = {
  "Cash/GPAY": "#2DD4BF",
  "Amazon Pay ICICI": "#F97362",
  "SBI": "#4C8DFF",
  "HDFC Swiggy": "#FF9F43",
  "Others": "#9CA9B4"
};

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function money(n) {
  n = Number(n) || 0;
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// "This month" isn't the same window for every payment mode — each card's
// statement cycle runs on its own dates. Cash/GPAY and Others use the plain
// calendar month (no entry needed below).
const CYCLE_RULES = {
  "Amazon Pay ICICI": { startDay: 19, endDay: 19 }, // 19th of previous month to 19th of this month
  "SBI": { startDay: 12, endDay: 12 },               // 12th of previous month to 12th of this month
  "HDFC Swiggy": { startDay: 15, endDay: 15 }        // 15th of previous month to 15th of this month
};

// Returns [start, end] Date objects (inclusive) for the cycle that contains `today`.
function currentCycleRange(paidBy, today = new Date()) {
  const rule = CYCLE_RULES[paidBy];
  const y = today.getFullYear(), m = today.getMonth();
  if (!rule) {
    return [new Date(y, m, 1), new Date(y, m + 1, 0)]; // plain calendar month
  }
  const endThisMonth = new Date(y, m, rule.endDay);
  if (today <= endThisMonth) return [new Date(y, m - 1, rule.startDay), endThisMonth];
  return [new Date(y, m, rule.startDay), new Date(y, m + 1, rule.endDay)];
}

// Is this entry inside its own payment mode's *current* billing cycle?
function isInCurrentCycle(entryDateStr, paidBy, today = new Date()) {
  const [start, end] = currentCycleRange(paidBy, today);
  const d = new Date(entryDateStr + "T00:00:00");
  return d >= new Date(start.getFullYear(), start.getMonth(), start.getDate())
      && d <= new Date(end.getFullYear(), end.getMonth(), end.getDate());
}
