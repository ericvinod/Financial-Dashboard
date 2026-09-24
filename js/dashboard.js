let charts = {};
function destroyChart(key) { if (charts[key]) { charts[key].destroy(); delete charts[key]; } }

async function renderDashboard() {
  const view = document.getElementById("view-dashboard");
  document.getElementById("dash-month").textContent = monthLabel(state.month);

  const [allEntries, budgets, income] = await Promise.all([
    Store.listAllExpenses(),
    Store.getBudgets(),
    Store.getIncome(state.month)
  ]);
  const entries = allEntries.filter(e => isInCurrentCycle(e.entry_date, e.paid_by));
  const displayEntries = entries;

  const totalIncome = income.reduce((s, r) => s + Number(r.amount), 0);
  const totalOutflow = displayEntries.reduce((s, e) => s + Number(e.amount), 0);
  const net = totalIncome - totalOutflow;
  const savingsRate = totalIncome ? (net / totalIncome) * 100 : 0;

  document.getElementById("stat-income").textContent = money(totalIncome);
  document.getElementById("stat-outflow").textContent = money(totalOutflow);
  const netEl = document.getElementById("stat-net");
  netEl.textContent = money(net);
  netEl.className = "value " + (net >= 0 ? "pos" : "neg");
  document.getElementById("stat-rate").textContent = savingsRate.toFixed(1) + "%";

  // Budget vs actual per category
  const actualByCat = {};
  displayEntries.forEach(e => { actualByCat[e.category] = (actualByCat[e.category] || 0) + Number(e.amount); });

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
  displayEntries.forEach(e => { byMode[e.paid_by] = (byMode[e.paid_by] || 0) + Number(e.amount); });
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

  // Entries list
  const list = document.getElementById("entries-list");
  let shownEntries = displayEntries;
  if (state.selectedMode) shownEntries = shownEntries.filter(e => e.paid_by === state.selectedMode);
  if (state.selectedCategory) shownEntries = shownEntries.filter(e => e.category === state.selectedCategory);
  shownEntries = shownEntries.slice().sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  const activeFilters = [
    state.selectedCategory ? { label: state.selectedCategory, clear: () => `selectCategory('${state.selectedCategory}')` } : null,
    state.selectedMode ? { label: state.selectedMode, clear: () => `selectMode('${state.selectedMode}')` } : null
  ].filter(Boolean);
  const filterNote = activeFilters.length
    ? `<div class="progress-note" style="margin-bottom:8px">Showing ${activeFilters.map(f => `<b>${f.label}</b>`).join(" + ")} only — <a href="#" onclick="${activeFilters.map(f => f.clear()).join(";")};return false">show all</a></div>`
    : "";
  if (!shownEntries.length) {
    list.innerHTML = filterNote + (entries.length
      ? `<div class="empty"><div class="big">🔍</div><p>No matching entries.</p></div>`
      : `<div class="empty"><div class="big">🧾</div><p>No entries yet this month.<br>Tap + to add one, or import a statement.</p></div>`);
  } else {
    list.innerHTML = filterNote + shownEntries.map(e => `
      <div class="entry" style="border-left-color:${CATEGORY_COLORS[e.category]}">
        <div class="row1"><span class="desc">${escapeHtml(e.description)}</span><span class="amt">${money(e.amount)}</span></div>
        <div class="meta">
          <span>${e.category}</span><span>·</span><span>${e.paid_by}</span><span>·</span><span>${e.entry_date}</span>
        </div>
        ${e.bill_url ? `<div style="margin-top:6px"><a class="bill-link" target="_blank" href="${e.bill_url}">📎 ${e.bill_type === "image" ? "View bill photo" : "View bill"}</a></div>` : ""}
        <div class="actions">
          <button onclick='openEntrySheet(${JSON.stringify(e).replace(/'/g, "&#39;")})'>Edit</button>
        </div>
      </div>`).join("");
  }
}

function miniPieOpts() {
  // No per-chart legend on purpose: the category rows just below already
  // show each color next to its name, and skipping the legend here means
  // both pies get the exact same layout, so they line up with each other.
  return { maintainAspectRatio: false, layout: { padding: 4 }, plugins: { legend: { display: false } } };
}

function pieOpts() {
  return {
    plugins: { legend: { position: "bottom", labels: { color: getComputedStyle(document.body).color, boxWidth: 10, font: { size: 10 }, padding: 8 } } },
    maintainAspectRatio: false
  };
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
