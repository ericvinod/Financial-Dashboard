async function renderInsights() {
  const box = document.getElementById("insights-list");
  const [budgets, recurring, all] = await Promise.all([
    Store.getBudgets(),
    Store.listRecurring(),
    Store.listAllExpenses()
  ]);
  const entries = all.filter(e => isInCurrentCycle(e.entry_date, e.paid_by));

  const insights = [];

  // Overspending vs budget
  const actualByCat = {};
  entries.forEach(e => { actualByCat[e.category] = (actualByCat[e.category] || 0) + Number(e.amount); });
  CATEGORIES.forEach(cat => {
    const budget = budgets[cat] || 0;
    const actual = actualByCat[cat] || 0;
    if (budget && actual > budget) {
      const over = (((actual - budget) / budget) * 100).toFixed(0);
      insights.push({ type: "warn", icon: "⚠️", title: `${cat} is over budget`, body: `${money(actual)} spent against a ${money(budget)} budget — ${over}% over.` });
    }
  });

  // Bills due within 7 days
  const today = new Date();
  const in7 = new Date(); in7.setDate(today.getDate() + 7);
  recurring.forEach(r => {
    if (!r.next_due) return;
    const d = new Date(r.next_due);
    if (d >= today && d <= in7) {
      insights.push({ type: "info", icon: "📅", title: `${r.name} due soon`, body: `${money(r.monthly_amount || r.premium_amount)} due on ${r.next_due}.` });
    }
  });

  // Unusual single charges: notably larger than the category's own average this month
  Object.keys(actualByCat).forEach(cat => {
    const rows = entries.filter(e => e.category === cat);
    if (rows.length < 2) return;
    const avg = actualByCat[cat] / rows.length;
    rows.forEach(e => {
      if (Number(e.amount) > avg * 2.2) {
        insights.push({ type: "warn", icon: "🔍", title: "Unusual charge", body: `"${e.description}" (${money(e.amount)}) is much larger than your typical ${cat} entry.` });
      }
    });
  });

  // Month-over-month takeaways
  const nonCurrent = all.filter(e => !isInCurrentCycle(e.entry_date, e.paid_by));
  const months = [...new Set(nonCurrent.map(e => cycleMonthKey(e.entry_date, e.paid_by)))].sort();
  const lastMonth = months[months.length - 1];
  if (lastMonth) {
    const lastByCat = {};
    nonCurrent.filter(e => cycleMonthKey(e.entry_date, e.paid_by) === lastMonth).forEach(e => { lastByCat[e.category] = (lastByCat[e.category] || 0) + Number(e.amount); });
    const deltas = CATEGORIES.map(cat => {
      const prev = lastByCat[cat] || 0;
      const curr = actualByCat[cat] || 0;
      if (!prev) return null;
      const pct = ((curr - prev) / prev) * 100;
      return { cat, pct, curr, prev };
    }).filter(d => d && Math.abs(d.pct) >= 15);
    deltas.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    deltas.slice(0, 3).forEach(d => {
      const dir = d.pct > 0 ? "up" : "down";
      insights.push({
        type: d.pct > 0 ? "warn" : "info",
        icon: d.pct > 0 ? "📈" : "📉",
        title: `${d.cat} is ${dir} ${Math.abs(d.pct).toFixed(0)}% this month`,
        body: `${money(d.curr)} vs ${money(d.prev)} last month.`
      });
    });
  } else {
    insights.push({ type: "info", icon: "🌱", title: "Building your history", body: "Month-over-month takeaways will show up once you have a full previous month of data." });
  }

  box.innerHTML = insights.length
    ? insights.map(i => `
        <div class="insight ${i.type}">
          <div class="icon">${i.icon}</div>
          <div class="body"><p class="title">${i.title}</p><p>${i.body}</p></div>
        </div>`).join("")
    : `<div class="empty"><div class="big">✅</div><p>Nothing needs your attention right now.</p></div>`;
}
