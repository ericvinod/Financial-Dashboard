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
// calendar month (no entry needed below). Each value is the cutoff day that
// closes one cycle and opens the next.
const CYCLE_RULES = {
  "Amazon Pay ICICI": 19,
  "SBI": 12,
  "HDFC Swiggy": 15
};

// Returns [start, end] Date objects (inclusive) for the given payment mode's
// cycle that belongs to the calendar month `today` falls in — e.g. for SBI
// (cutoff 12) in September, that's always 12 Aug → 12 Sep, whether today is
// Sep 1 or Sep 30. This is anchored to the calendar month, not a rolling
// window from today's exact day.
function currentCycleRange(paidBy, today = new Date()) {
  const cutoff = CYCLE_RULES[paidBy];
  const y = today.getFullYear(), m = today.getMonth();
  if (cutoff === undefined) return [new Date(y, m, 1), new Date(y, m + 1, 0)]; // plain calendar month
  return [new Date(y, m - 1, cutoff), new Date(y, m, cutoff)];
}

// Is this entry inside its own payment mode's *current* billing cycle?
function isInCurrentCycle(entryDateStr, paidBy, today = new Date()) {
  const [start, end] = currentCycleRange(paidBy, today);
  const d = new Date(entryDateStr + "T00:00:00");
  return d >= new Date(start.getFullYear(), start.getMonth(), start.getDate())
      && d <= new Date(end.getFullYear(), end.getMonth(), end.getDate());
}

// Which reporting month (YYYY-MM) does this entry belong to, per its own
// payment mode's cycle? E.g. for SBI (cutoff 12), an entry dated Aug 20
// falls after August's cutoff, so it belongs to September's cycle (12 Aug →
// 12 Sep) and is reported as "2026-09", not "2026-08". Used by History and
// Insights so a whole statement reports under one consistent month even
// though its transactions span two calendar months.
function cycleMonthKey(entryDateStr, paidBy) {
  const cutoff = CYCLE_RULES[paidBy];
  const d = new Date(entryDateStr + "T00:00:00");
  let y = d.getFullYear(), m = d.getMonth(); // 0-based
  if (cutoff !== undefined && d.getDate() > cutoff) {
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}
