let openMonth = null;

async function renderHistory() {
  const all = await Store.listAllExpenses();
  const byMonth = {};
  all.forEach(e => {
    if (e.month === state.month) return; // current month lives on the dashboard
    (byMonth[e.month] = byMonth[e.month] || []).push(e);
  });
  const months = Object.keys(byMonth).sort();

  const trendBox = document.getElementById("history-trend-wrap");
  const listBox = document.getElementById("history-list");

  if (!months.length) {
    trendBox.style.display = "none";
    listBox.innerHTML = `<div class="empty"><div class="big">📈</div><p>No historical data yet.<br>Once this month closes, its summary will appear here — trends build up month over month.</p></div>`;
    return;
  }
  trendBox.style.display = "block";

  const monthlyTotals = months.map(m => byMonth[m].reduce((s, e) => s + Number(e.amount), 0));
  destroyChart("trend");
  charts.trend = new Chart(document.getElementById("chart-trend"), {
    type: "line",
    data: {
      labels: months.map(m => monthLabel(m).replace(" ", "\n")),
      datasets: [{
        label: "Total spend",
        data: monthlyTotals,
        borderColor: "#2DD9C4",
        backgroundColor: "rgba(45,217,196,0.15)",
        tension: 0.3,
        fill: true,
        pointBackgroundColor: "#2DD9C4"
      }]
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: "#9FBAC2", font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: "#9FBAC2", font: { size: 10 } }, grid: { color: "rgba(159,186,194,0.1)" } }
      },
      plugins: { legend: { display: false } }
    }
  });

  listBox.innerHTML = months.slice().reverse().map(m => {
    const rows = byMonth[m];
    const total = rows.reduce((s, e) => s + Number(e.amount), 0);
    return `
      <div class="month-pill" id="pill-${m}" onclick="toggleMonth('${m}')">
        <div>
          <div class="name">${monthLabel(m)}</div>
          <div class="sub">${rows.length} entries · ${money(total)} spent</div>
        </div>
        <span class="chev">›</span>
      </div>
      <div class="month-detail" id="detail-${m}"></div>`;
  }).join("");

  if (openMonth && byMonth[openMonth]) renderMonthDetail(openMonth, byMonth[openMonth]);
}

function toggleMonth(m) {
  const detail = document.getElementById("detail-" + m);
  const pill = document.getElementById("pill-" + m);
  const isOpen = detail.classList.contains("open");
  document.querySelectorAll(".month-detail.open").forEach(d => d.classList.remove("open"));
  document.querySelectorAll(".month-pill.open").forEach(p => p.classList.remove("open"));
  if (isOpen) { openMonth = null; return; }
  openMonth = m;
  pill.classList.add("open");
  detail.classList.add("open");
  Store.listAllExpenses().then(all => renderMonthDetail(m, all.filter(e => e.month === m)));
}

function renderMonthDetail(m, rows) {
  const detail = document.getElementById("detail-" + m);
  if (!detail) return;

  const byCat = {};
  rows.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount); });
  const cats = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
  const total = rows.reduce((s, e) => s + Number(e.amount), 0);

  // Weekly breakdown within the month
  const weekly = {};
  rows.forEach(e => {
    const day = Number(e.entry_date.slice(8, 10));
    const wk = "Week " + (Math.floor((day - 1) / 7) + 1);
    weekly[wk] = (weekly[wk] || 0) + Number(e.amount);
  });
  const weekLabels = Object.keys(weekly).sort();

  detail.innerHTML = `
    <div class="panel">
      <h3>Category breakdown</h3>
      <div class="chart-wrap small"><canvas id="pie-${m}"></canvas></div>
      ${cats.map(c => `
        <div class="cat-row">
          <div class="cat-head">
            <span class="cat-name"><span class="dot" style="background:${CATEGORY_COLORS[c] || "#888"}"></span>${c}</span>
            <span class="amounts"><b>${money(byCat[c])}</b> · ${((byCat[c] / total) * 100).toFixed(0)}%</span>
          </div>
        </div>`).join("")}
    </div>
    <div class="panel">
      <h3>By week</h3>
      <div class="chart-wrap small"><canvas id="week-${m}"></canvas></div>
    </div>`;

  new Chart(document.getElementById("pie-" + m), {
    type: "pie",
    data: { labels: cats, datasets: [{ data: cats.map(c => byCat[c]), backgroundColor: cats.map(c => CATEGORY_COLORS[c] || "#888"), borderWidth: 0 }] },
    options: pieOpts()
  });
  new Chart(document.getElementById("week-" + m), {
    type: "bar",
    data: { labels: weekLabels, datasets: [{ data: weekLabels.map(w => weekly[w]), backgroundColor: "#2DD9C4" }] },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#9FBAC2", font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: "#9FBAC2", font: { size: 10 } }, grid: { color: "rgba(159,186,194,0.1)" } }
      }
    }
  });
}
