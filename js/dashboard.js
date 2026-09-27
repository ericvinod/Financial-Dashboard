let charts = {};
function destroyChart(key) { if (charts[key]) { charts[key].destroy(); delete charts[key]; } }

async function renderDashboard() {
  const view = document.getElementById("view-dashboard");
  document.getElementById("dash-month").textContent = monthLabel(state.month);

  const [allEntries, income, unbilled] = await Promise.all([
    Store.listAllExpenses(),
    Store.getIncome(state.month),
    Store.getUnbilledAmounts()
  ]);
  const entries = allEntries.filter(e => isInCurrentCycle(e.entry_date, e.paid_by));
  const displayEntries = entries;

  const totalIncome = income.reduce((s, r) => s + Number(r.amount), 0);
  const totalOutflow = displayEntries.reduce((s, e) => s + Number(e.amount), 0);
  const net = totalIncome - totalOutflow;

  document.getElementById("stat-income").textContent = money(totalIncome);
  document.getElementById("stat-outflow").textContent = money(totalOutflow);
  const netEl = document.getElementById("stat-net");
  netEl.textContent = money(net);
  netEl.className = "value " + (net >= 0 ? "pos" : "neg");

  document.getElementById("unbilled-rows").innerHTML = CREDIT_CARDS.map(card => `
    <div class="cat-row">
      <div class="cat-head">
        <span class="cat-name"><span class="dot" style="background:${PAID_BY_COLORS[card]}"></span>${card}</span>
      </div>
      <input type="number" step="0.01" value="${unbilled[card] || ""}" placeholder="0"
        onchange="Store.setUnbilledAmount('${card}', parseFloat(this.value) || 0).then(()=>{toast('Saved');renderDashboard();}).catch(err=>toast(err.message))">
    </div>`).join("");

  destroyChart("unbilledPie");
  charts.unbilledPie = new Chart(document.getElementById("chart-unbilled-pie"), {
    type: "pie",
    data: { labels: CREDIT_CARDS, datasets: [{ data: CREDIT_CARDS.map(c => unbilled[c] || 0), backgroundColor: CREDIT_CARDS.map(c => PAID_BY_COLORS[c]), borderWidth: 0 }] },
    options: pieOpts()
  });

  // Entries list
  const list = document.getElementById("entries-list");
  let shownEntries = displayEntries;
  if (state.selectedMode) shownEntries = shownEntries.filter(e => (PAID_BY.includes(e.paid_by) ? e.paid_by : "Others") === state.selectedMode);
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
