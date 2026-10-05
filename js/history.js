let openMonth = null;

async function renderHistory() {
  const all = await Store.listAllExpenses();
  const currentKey = monthKey();
  const byMonth = {};
  all.forEach(e => {
    const key = cycleMonthKey(e.entry_date, e.paid_by);
    if (key === currentKey) return; // current cycle lives on the dashboard
    (byMonth[key] = byMonth[key] || []).push(e);
  });
  const months = Object.keys(byMonth).sort();

  renderSavedByMonth(byMonth, months);

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

const MONTH_SLICE_COLORS = ["#2DD9C4", "#4C8DFF", "#F97362", "#FFC107", "#8BD156", "#FF6FB0", "#7030A0", "#F0B94A"];

function renderSavedByMonth(byMonth, months) {
  const wrap = document.getElementById("saved-trend-wrap");
  const savedByMonthKey = {};
  months.forEach(m => {
    const total = byMonth[m].filter(e => e.category === "Saved").reduce((s, e) => s + Number(e.amount), 0);
    if (total > 0) savedByMonthKey[m] = total;
  });
  const savedMonths = Object.keys(savedByMonthKey).sort();

  destroyChart("savedByMonth");
  if (!savedMonths.length) {
    wrap.querySelector(".chart-wrap").style.display = "none";
    document.getElementById("saved-rows").innerHTML = `<p class="progress-note">No "Saved" entries logged in previous months yet.</p>`;
    return;
  }
  wrap.querySelector(".chart-wrap").style.display = "block";

  const colors = savedMonths.map((_, i) => MONTH_SLICE_COLORS[i % MONTH_SLICE_COLORS.length]);
  charts.savedByMonth = new Chart(document.getElementById("chart-saved-pie"), {
    type: "bar",
    data: { labels: savedMonths.map(monthLabel), datasets: [{ data: savedMonths.map(m => savedByMonthKey[m]), backgroundColor: colors, borderWidth: 0 }] },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#9FBAC2", font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: "#9FBAC2", font: { size: 10 } }, grid: { color: "rgba(159,186,194,0.1)" } }
      }
    }
  });

  document.getElementById("saved-rows").innerHTML = savedMonths.map((m, i) => `
    <div class="cat-row">
      <div class="cat-head">
        <span class="cat-name"><span class="dot" style="background:${colors[i]}"></span>${monthLabel(m)}</span>
        <span class="amounts"><b>${money(savedByMonthKey[m])}</b></span>
      </div>
    </div>`).join("");
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
  Store.listAllExpenses().then(all => renderMonthDetail(m, all.filter(e => cycleMonthKey(e.entry_date, e.paid_by) === m)));
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
    </div>
    <div class="panel">
      <h3>Entries</h3>
      ${rows.slice().sort((a, b) => b.entry_date.localeCompare(a.entry_date)).map(e => `
        <div class="entry" style="border-left-color:${CATEGORY_COLORS[e.category] || "#888"}">
          <div class="row1"><span class="desc">${escapeHtml(e.description)}</span><span class="amt">${money(e.amount)}</span></div>
          <div class="meta"><span>${e.category}</span><span>·</span><span>${e.paid_by}</span><span>·</span><span>${e.entry_date}</span></div>
          ${e.bill_url ? `<div style="margin-top:6px"><a class="bill-link" target="_blank" href="${e.bill_url}">📎 ${e.bill_type === "image" ? "View bill photo" : "View bill"}</a></div>` : ""}
          <div class="actions"><button onclick='openEntrySheet(${JSON.stringify(e).replace(/'/g, "&#39;")})'>Edit</button></div>
        </div>`).join("")}
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
