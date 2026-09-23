// ---- Connection settings -------------------------------------------------
// These point the app at your project's data store. Nothing about them is
// shown in the interface — the app only ever talks about "your data".
const DB_URL = "https://ayxmhtojfwdcuodxmlzm.supabase.co";
const DB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5eG1odG9qZndkY3VvZHhtbHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5ODAxMDgsImV4cCI6MjEwNTU1NjEwOH0.C8XHDltPKBcYfFkloNfY9H_6gwRcblmZRBOj4luiyXc";

const db = window.supabase.createClient(DB_URL, DB_KEY);

// ---- Fixed vocabularies ----------------------------------------------------
const CATEGORIES = [
  "Parents Expenses", "Home Expenses", "Home Loan EMI", "Milk", "Non-veg",
  "Rachael", "Petrol", "Vegetable and Groceries", "Mobile", "WiFi"
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
  "WiFi": "#00B050"
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
