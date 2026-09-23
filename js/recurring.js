let calMonth = new Date();

async function renderRecurring() {
  const [recurring, emis] = await Promise.all([Store.listRecurring(), Store.listCreditEmi()]);
  document.getElementById("cal-label").textContent = calMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const year = calMonth.getFullYear(), month = calMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dueByDay = {};
  recurring.forEach(r => {
    if (!r.next_due) return;
    const d = new Date(r.next_due);
    if (d.getFullYear() === year && d.getMonth() === month) {
      (dueByDay[d.getDate()] = dueByDay[d.getDate()] || []).push(r);
    }
  });

  const dows = ["S", "M", "T", "W", "T", "F", "S"];
  let html = dows.map(d => `<div class="dow">${d}</div>`).join("");
  for (let i = 0; i < firstDow; i++) html += `<div class="cal-cell empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const items = dueByDay[day];
    html += `<div class="cal-cell ${items ? "has-bill" : ""}">${day}${items ? `<span class="dot-bill"></span>` : ""}</div>`;
  }
  document.getElementById("cal-grid").innerHTML = html;

  const dueList = Object.keys(dueByDay).sort((a, b) => a - b).flatMap(d => dueByDay[d]);
  document.getElementById("due-list").innerHTML = dueList.length
    ? dueList.map(r => `
        <div class="bill-item">
          <div>
            <div>${escapeHtml(r.name)}</div>
            <div class="when">${r.frequency} · ${r.person || ""}</div>
          </div>
          <div style="text-align:right">
            <div><b>${money(r.monthly_amount || r.premium_amount)}</b></div>
            <div class="when">${r.next_due}</div>
          </div>
        </div>`).join("")
    : `<p class="progress-note">No bills due this month.</p>`;

  document.getElementById("all-recurring").innerHTML = recurring.map(r => `
    <div class="bill-item" style="cursor:pointer" onclick='openRecurringSheet(${JSON.stringify(r).replace(/'/g, "&#39;")})'>
      <div>
        <div>${escapeHtml(r.name)}</div>
        <div class="when">${r.frequency}${r.sum_insured ? " · Cover " + r.sum_insured : ""}</div>
      </div>
      <div style="text-align:right">
        <div><b>${money(r.monthly_amount || r.premium_amount)}</b>/mo</div>
        <div class="when">${r.next_due || "no date set"}</div>
      </div>
    </div>`).join("") || `<p class="progress-note">No recurring bills added yet.</p>`;

  document.getElementById("emi-list").innerHTML = emis.length
    ? emis.map(e => `
        <div class="bill-item">
          <div>
            <div>${e.card} · ${escapeHtml(e.product)}</div>
            <div class="when">Installment ${e.emi_no}</div>
          </div>
          <div><b>${money(e.emi_amount)}</b>/mo</div>
        </div>`).join("")
    : `<p class="progress-note">No active card EMIs.</p>`;
}

document.getElementById("cal-prev").addEventListener("click", () => { calMonth.setMonth(calMonth.getMonth() - 1); renderRecurring(); });
document.getElementById("cal-next").addEventListener("click", () => { calMonth.setMonth(calMonth.getMonth() + 1); renderRecurring(); });

let editingRecurringId = null;
function openRecurringSheet(r) {
  editingRecurringId = r ? r.id : null;
  document.getElementById("rec-title").textContent = r ? "Edit recurring bill" : "Add recurring bill";
  document.getElementById("rec-name").value = r ? r.name : "";
  document.getElementById("rec-date").value = r ? r.next_due || "" : "";
  document.getElementById("rec-person").value = r ? r.person || "" : "";
  document.getElementById("rec-freq").value = r ? r.frequency || "Yearly" : "Yearly";
  document.getElementById("rec-amount").value = r ? (r.monthly_amount || "") : "";
  document.getElementById("rec-delete").style.display = r ? "inline-flex" : "none";
  openSheet("recurring-overlay");
}
document.getElementById("add-recurring-btn").addEventListener("click", () => openRecurringSheet(null));

document.getElementById("recurring-form").addEventListener("submit", async e => {
  e.preventDefault();
  const payload = {
    name: document.getElementById("rec-name").value.trim(),
    next_due: document.getElementById("rec-date").value || null,
    person: document.getElementById("rec-person").value.trim(),
    frequency: document.getElementById("rec-freq").value,
    monthly_amount: parseFloat(document.getElementById("rec-amount").value) || 0
  };
  if (!payload.name) { toast("Give this bill a name."); return; }
  await withStatus(async () => {
    if (editingRecurringId) await Store.updateRecurring(editingRecurringId, payload);
    else await Store.addRecurring(payload);
  });
  closeSheet("recurring-overlay");
  toast("Saved");
  renderRecurring();
});

document.getElementById("rec-delete").addEventListener("click", async () => {
  if (!editingRecurringId || !confirm("Delete this recurring bill?")) return;
  await withStatus(() => Store.deleteRecurring(editingRecurringId));
  closeSheet("recurring-overlay");
  renderRecurring();
});
