// The original uploaded budget tracker, kept here as a fixed reference —
// shown as-is in the Analysis tab, not editable and not tied to the database.
const ORIGINAL_BUDGET_SHEET = {
  income: 217000,
  expenses: 117892,
  savings: 99108,
  rows: [
    { desc: "Mylai marie agam Primary Loan", category: "Home Loan EMI", paidBy: "Cash/GPAY", amount: 32000 },
    { desc: "Vinod House", category: "Parents Expenses", paidBy: "Cash/GPAY", amount: 15000 },
    { desc: "Veena House Rent", category: "Parents Expenses", paidBy: "Cash/GPAY", amount: 16500 },
    { desc: "Maintanence", category: "Home Expenses", paidBy: "Cash/GPAY", amount: 2000 },
    { desc: "Milk", category: "Home Expenses", paidBy: "Cash/GPAY", amount: 700 },
    { desc: "Veena Dad", category: "Parents Expenses", paidBy: "Cash/GPAY", amount: 5000 },
    { desc: "Non-Veg", category: "Non-veg", paidBy: "Cash/GPAY", amount: 4000 },
    { desc: "Giggle whiz phonics class", category: "Rachael", paidBy: "Cash/GPAY", amount: 2000 },
    { desc: "Theater Class", category: "Rachael", paidBy: "Cash/GPAY", amount: 1800 },
    { desc: "Auto school pickup", category: "Rachael", paidBy: "Cash/GPAY", amount: 6000 },
    { desc: "Vinod dad medicine pharmeasy", category: "Parents Expenses", paidBy: "Cash/GPAY", amount: 2000 },
    { desc: "Ironing", category: "Home Expenses", paidBy: "Cash/GPAY", amount: 1000 },
    { desc: "Petrol", category: "Home Expenses", paidBy: "Amazon Pay ICICI", amount: 8000 },
    { desc: "Vegetables", category: "Vegetable and Groceries", paidBy: "HDFC Swiggy", amount: 6000 },
    { desc: "Groceries both for us, and veena house", category: "Vegetable and Groceries", paidBy: "SBI", amount: 12000 },
    { desc: "Veena dad liquor", category: "Parents Expenses", paidBy: "SBI", amount: 1000 },
    { desc: "Jio ( Eric & Veena)", category: "Mobile", paidBy: "Amazon Pay ICICI", amount: 600 },
    { desc: "Airtel (Eric & Veena)", category: "Mobile", paidBy: "Amazon Pay ICICI", amount: 1092 },
    { desc: "ACT Wifi", category: "WiFi", paidBy: "Amazon Pay ICICI", amount: 1200 }
  ]
};

function renderBudgetSheet() {
  document.getElementById("budget-sheet-rows").innerHTML = ORIGINAL_BUDGET_SHEET.rows.map(r => `
    <div class="bill-item">
      <div>
        ${escapeHtml(r.desc)}
        <div class="when">${r.category} · ${r.paidBy}</div>
      </div>
      <div><b>${money(r.amount)}</b></div>
    </div>`).join("");
  document.getElementById("bs-income").textContent = money(ORIGINAL_BUDGET_SHEET.income);
  document.getElementById("bs-expenses").textContent = money(ORIGINAL_BUDGET_SHEET.expenses);
  document.getElementById("bs-savings").textContent = money(ORIGINAL_BUDGET_SHEET.savings);
}

async function renderAnalysis() {
  renderBudgetSheet();

  const [allEntries, budgets, paymentBudgets] = await Promise.all([
    Store.listAllExpenses(),
    Store.getBudgets(),
    Store.getPaymentModeBudgets()
  ]);
  const entries = allEntries.filter(e => isInCurrentCycle(e.entry_date, e.paid_by));

  // Budget vs actual per category
  const actualByCat = {};
  entries.forEach(e => { actualByCat[e.category] = (actualByCat[e.category] || 0) + Number(e.amount); });

  const catRows = document.getElementById("cat-rows");
  catRows.innerHTML = CATEGORIES.map(cat => {
    const budget = budgets[cat] || 0;
    const actual = actualByCat[cat] || 0;
    const pct = budget ? Math.min(100, (actual / budget) * 100) : (actual ? 100 : 0);
    const over = budget && actual > budget;
    const selected = state.selectedCategory === cat;
    return `
      <div class="cat-row" style="cursor:pointer;${selected ? `outline:1.5px solid ${CATEGORY_COLORS[cat]};border-radius:8px;padding:4px 6px;margin:0 -6px 12px` : ""}" onclick="selectCategory('${cat}')">
        <div class="cat-head">
          <span class="cat-name"><span class="dot" style="background:${CATEGORY_COLORS[cat]}"></span>${cat}</span>
          <span class="amounts"><b>${money(actual)}</b> / ${money(budget)}</span>
        </div>
        <div class="bar-track"><div class="bar-fill ${over ? "over" : ""}" style="width:${pct}%;${over ? "" : `background:${CATEGORY_COLORS[cat]}`}"></div></div>
      </div>`;
  }).join("");

  // Budget vs actual pie charts
  destroyChart("budgetPie"); destroyChart("actualPie"); destroyChart("paidByPie");
  const catsWithData = CATEGORIES.filter(c => (budgets[c] || 0) > 0 || (actualByCat[c] || 0) > 0);
  const colors = catsWithData.map(c => CATEGORY_COLORS[c]);

  charts.budgetPie = new Chart(document.getElementById("chart-budget-pie"), {
    type: "pie",
    data: { labels: catsWithData, datasets: [{ data: catsWithData.map(c => budgets[c] || 0), backgroundColor: colors, borderWidth: 0 }] },
    options: miniPieOpts()
  });
  charts.actualPie = new Chart(document.getElementById("chart-actual-pie"), {
    type: "pie",
    data: { labels: catsWithData, datasets: [{ data: catsWithData.map(c => actualByCat[c] || 0), backgroundColor: colors, borderWidth: 0 }] },
    options: miniPieOpts()
  });

  // Spend by payment mode
  const byMode = {};
  PAID_BY.forEach(m => (byMode[m] = 0));
  entries.forEach(e => {
    const key = PAID_BY.includes(e.paid_by) ? e.paid_by : "Others";
    byMode[key] = (byMode[key] || 0) + Number(e.amount);
  });
  const modeRows = document.getElementById("mode-rows");
  const modeTotal = Object.values(byMode).reduce((a, b) => a + b, 0) || 1;
  modeRows.innerHTML = PAID_BY.map(m => `
    <div class="cat-row" style="cursor:pointer;${state.selectedMode === m ? `outline:1.5px solid ${PAID_BY_COLORS[m]};border-radius:8px;padding:4px 6px;margin:0 -6px 12px` : ""}" onclick="selectMode('${m}')">
      <div class="cat-head">
        <span class="cat-name"><span class="dot" style="background:${PAID_BY_COLORS[m]}"></span>${m}</span>
        <span class="amounts"><b>${money(byMode[m])}</b></span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${(byMode[m] / modeTotal) * 100}%;background:${PAID_BY_COLORS[m]}"></div></div>
    </div>`).join("");
  charts.paidByPie = new Chart(document.getElementById("chart-mode-pie"), {
    type: "doughnut",
    data: { labels: PAID_BY, datasets: [{ data: PAID_BY.map(m => byMode[m]), backgroundColor: PAID_BY.map(m => PAID_BY_COLORS[m]), borderWidth: 0 }] },
    options: pieOpts()
  });

  // Budget vs actual by payment type
  const payRows = document.getElementById("pay-budget-rows");
  payRows.innerHTML = PAID_BY.map(m => {
    const budget = paymentBudgets[m] || 0;
    const actual = byMode[m] || 0;
    const pct = budget ? Math.min(100, (actual / budget) * 100) : (actual ? 100 : 0);
    const over = budget && actual > budget;
    return `
      <div class="cat-row">
        <div class="cat-head">
          <span class="cat-name"><span class="dot" style="background:${PAID_BY_COLORS[m]}"></span>${m}</span>
          <span class="amounts"><b>${money(actual)}</b> / ${money(budget)}</span>
        </div>
        <div class="bar-track"><div class="bar-fill ${over ? "over" : ""}" style="width:${pct}%;${over ? "" : `background:${PAID_BY_COLORS[m]}`}"></div></div>
      </div>`;
  }).join("");
}
