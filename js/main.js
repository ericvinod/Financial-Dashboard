// ---------------------------------------------------------------------------
// App state & tab navigation
// ---------------------------------------------------------------------------
const state = {
  month: monthKey(),
  editingId: null,
  pendingBill: null, // { url, type } for the entry currently being composed
  importDraft: []    // rows staged from a statement, awaiting confirmation
};

function setStatus(text, cls) {
  const el = document.getElementById("status");
  el.textContent = text;
  el.className = "status " + (cls || "");
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

async function withStatus(fn) {
  setStatus("Saving…", "saving");
  try {
    await fn();
    setStatus("All changes saved", "saved");
  } catch (e) {
    setStatus("Couldn't save — try again", "");
    toast(e.message || "Something went wrong.");
    throw e;
  }
}

const TABS = ["dashboard", "history", "recurring", "insights"];

function showTab(name) {
  TABS.forEach(t => {
    document.getElementById("view-" + t).classList.toggle("active", t === name);
    document.getElementById("tab-" + t).classList.toggle("active", t === name);
  });
  document.getElementById("fab").style.display = name === "dashboard" ? "flex" : "none";
  if (name === "dashboard") renderDashboard();
  if (name === "history") renderHistory();
  if (name === "recurring") renderRecurring();
  if (name === "insights") renderInsights();
}

function openSheet(id) { document.getElementById(id).classList.add("active"); }
function closeSheet(id) { document.getElementById(id).classList.remove("active"); }

// ---------------------------------------------------------------------------
// Add / edit entry sheet
// ---------------------------------------------------------------------------
function fillSelect(sel, options) {
  sel.innerHTML = options.map(o => `<option value="${o}">${o}</option>`).join("");
}

function openEntrySheet(entry) {
  state.editingId = entry ? entry.id : null;
  state.pendingBill = entry ? { url: entry.bill_url, type: entry.bill_type } : null;
  document.getElementById("entry-sheet-title").textContent = entry ? "Edit entry" : "Add entry";
  document.getElementById("f-date").value = entry ? entry.entry_date : new Date().toISOString().slice(0, 10);
  document.getElementById("f-desc").value = entry ? entry.description : "";
  document.getElementById("f-category").value = entry ? entry.category : CATEGORIES[0];
  document.getElementById("f-paidby").value = entry ? entry.paid_by : PAID_BY[0];
  document.getElementById("f-amount").value = entry ? entry.amount : "";
  document.getElementById("f-notes").value = entry ? entry.notes || "" : "";
  document.getElementById("f-drivelink").value = entry && entry.bill_type === "drive_link" ? entry.bill_url : "";
  renderBillPreview();
  document.getElementById("entry-delete").style.display = entry ? "inline-flex" : "none";
  openSheet("entry-overlay");
}

function renderBillPreview() {
  const box = document.getElementById("bill-preview");
  if (!state.pendingBill || !state.pendingBill.url) { box.innerHTML = ""; return; }
  const { url, type } = state.pendingBill;
  if (type === "image") {
    box.innerHTML = `<a href="${url}" target="_blank"><img src="${url}" style="max-width:100%;border-radius:8px;margin-top:8px"></a>`;
  } else {
    box.innerHTML = `<a class="bill-link" href="${url}" target="_blank">📎 View attached bill</a>`;
  }
}

document.getElementById("f-file").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  setStatus("Attaching…", "saving");
  try {
    const url = await Store.uploadBill(file);
    const type = file.type.startsWith("image/") ? "image" : "pdf";
    state.pendingBill = { url, type };
    document.getElementById("f-drivelink").value = "";
    renderBillPreview();
    setStatus("All changes saved", "saved");
  } catch (err) {
    setStatus("Couldn't save — try again", "");
    toast(err.message);
  }
});

document.getElementById("f-drivelink").addEventListener("input", e => {
  const val = e.target.value.trim();
  if (val) {
    state.pendingBill = { url: val, type: "drive_link" };
    renderBillPreview();
  }
});

document.getElementById("entry-form").addEventListener("submit", async e => {
  e.preventDefault();
  const payload = {
    entry_date: document.getElementById("f-date").value,
    description: document.getElementById("f-desc").value.trim(),
    category: document.getElementById("f-category").value,
    paid_by: document.getElementById("f-paidby").value,
    amount: parseFloat(document.getElementById("f-amount").value),
    notes: document.getElementById("f-notes").value.trim(),
    bill_url: state.pendingBill ? state.pendingBill.url : null,
    bill_type: state.pendingBill ? state.pendingBill.type : null
  };
  if (!payload.description || !payload.amount) { toast("Add a description and amount first."); return; }
  await withStatus(async () => {
    if (state.editingId) await Store.updateExpense(state.editingId, payload);
    else await Store.addExpense(payload);
  });
  closeSheet("entry-overlay");
  toast(state.editingId ? "Entry updated" : "Entry added");
  renderDashboard();
});

document.getElementById("entry-delete").addEventListener("click", async () => {
  if (!state.editingId) return;
  if (!confirm("Delete this entry?")) return;
  await withStatus(() => Store.deleteExpense(state.editingId));
  closeSheet("entry-overlay");
  toast("Entry deleted");
  renderDashboard();
});

// ---------------------------------------------------------------------------
// Statement import sheet
// ---------------------------------------------------------------------------
function openImportSheet() {
  state.importDraft = [];
  document.getElementById("import-progress").textContent = "";
  document.getElementById("import-review").innerHTML = "";
  document.getElementById("import-confirm").style.display = "none";

  const overlay = document.getElementById("import-overlay");
  const pop = overlay.querySelector(".popover");
  const btn = document.getElementById("import-btn");
  const r = btn.getBoundingClientRect();
  const popWidth = Math.min(340, window.innerWidth * 0.92);
  let left = r.right - popWidth;
  left = Math.max(8, Math.min(left, window.innerWidth - popWidth - 8));
  const top = Math.min(r.bottom + 8, window.innerHeight - 60);
  pop.style.left = left + "px";
  pop.style.top = top + "px";

  openSheet("import-overlay");
}

// Clicking the transparent backdrop (but not the popover itself) closes it.
document.getElementById("import-overlay").addEventListener("click", e => {
  if (e.target.id === "import-overlay") closeSheet("import-overlay");
});

async function handleStatementFile(file, source, paidBy) {
  const progressEl = document.getElementById("import-progress");
  progressEl.textContent = "Reading file…";
  try {
    const rows = await parseStatement(file, paidBy, source, pct => { progressEl.textContent = `Reading image… ${pct}%`; });
    if (!rows.length) {
      progressEl.textContent = "Couldn't find any transactions in that file. Try a clearer file, or add entries manually.";
      return;
    }
    state.importDraft = rows;
    progressEl.textContent = `Found ${rows.length} transaction${rows.length > 1 ? "s" : ""} — review before saving:`;
    renderImportReview();
    document.getElementById("import-confirm").style.display = "block";
  } catch (err) {
    progressEl.textContent = err.message || "Couldn't read that file.";
  }
}

function renderImportReview() {
  const box = document.getElementById("import-review");
  box.innerHTML = state.importDraft.map((r, i) => `
    <div class="import-row">
      <input type="date" value="${r.entry_date}" onchange="state.importDraft[${i}].entry_date=this.value">
      <input type="text" value="${r.description}" style="flex:1" onchange="state.importDraft[${i}].description=this.value">
    </div>
    <div class="import-row">
      <select onchange="state.importDraft[${i}].category=this.value">
        ${CATEGORIES.map(c => `<option ${c === r.category ? "selected" : ""}>${c}</option>`).join("")}
      </select>
      <input type="number" value="${r.amount}" step="0.01" style="width:90px" onchange="state.importDraft[${i}].amount=parseFloat(this.value)">
      <button class="btn small ghost" onclick="removeImportRow(${i})">✕</button>
    </div>
  `).join("");
}

function removeImportRow(i) {
  state.importDraft.splice(i, 1);
  renderImportReview();
  if (!state.importDraft.length) document.getElementById("import-confirm").style.display = "none";
}

document.querySelectorAll(".import-source input[type=file]").forEach(input => {
  input.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    handleStatementFile(file, input.dataset.source, input.dataset.paidby);
  });
});

document.getElementById("import-confirm").addEventListener("click", async () => {
  if (!state.importDraft.length) return;
  await withStatus(() => Store.addExpenses(state.importDraft));
  closeSheet("import-overlay");
  toast(`${state.importDraft.length} entries added`);
  renderDashboard();
});

// ---------------------------------------------------------------------------
// Income sheet
// ---------------------------------------------------------------------------
async function openIncomeSheet() {
  const rows = await Store.getIncome(state.month);
  const box = document.getElementById("income-list");
  box.innerHTML = rows.map(r => `
    <div class="import-row">
      <input type="text" value="${r.source}" onchange="Store.updateIncome('${r.id}',{source:this.value})">
      <input type="number" value="${r.amount}" style="width:100px" onchange="Store.updateIncome('${r.id}',{amount:parseFloat(this.value)}).then(renderDashboard)">
      <button class="btn small ghost" onclick="deleteIncomeRow('${r.id}')">✕</button>
    </div>
  `).join("") || `<p class="progress-note">No income entries yet for this month.</p>`;
  openSheet("income-overlay");
}

async function deleteIncomeRow(id) {
  await Store.deleteIncome(id);
  openIncomeSheet();
  renderDashboard();
}

document.getElementById("income-add").addEventListener("click", async () => {
  const source = document.getElementById("income-source").value.trim();
  const amount = parseFloat(document.getElementById("income-amount").value);
  if (!source || !amount) { toast("Add a source and amount."); return; }
  await withStatus(() => Store.addIncome(state.month, source, amount));
  document.getElementById("income-source").value = "";
  document.getElementById("income-amount").value = "";
  openIncomeSheet();
  renderDashboard();
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  fillSelect(document.getElementById("f-category"), CATEGORIES);
  fillSelect(document.getElementById("f-paidby"), PAID_BY);
  TABS.forEach(t => document.getElementById("tab-" + t).addEventListener("click", () => showTab(t)));
  document.getElementById("fab").addEventListener("click", () => openEntrySheet(null));
  document.getElementById("income-card").addEventListener("click", openIncomeSheet);
  document.getElementById("import-btn").addEventListener("click", openImportSheet);
  document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => closeSheet(b.dataset.close)));
  showTab("dashboard");
});
