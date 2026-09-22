// Application State & Configuration
const CONFIG_A = "https://ayxmhtojfwdcuodxmlzm.supabase.co";
const CONFIG_B = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5eG1odG9qZndkY3VvZHhtbHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5ODAxMDgsImV4cCI6MjEwNTU1NjEwOH0.C8XHDltPKBcYfFkloNfY9H_6gwRcblmZRBOj4luiyXc";

// Client Initialization
const client = supabase.createClient(CONFIG_A, CONFIG_B);

// Color standards aligned with workbook themes
const CATEGORY_COLORS = {
  "Parents Expenses": "#3b82f6",
  "Home Expenses": "#10b981",
  "Home Loan EMI": "#ef4444",
  "Milk": "#06b6d4",
  "Non-veg": "#f97316",
  "Rachael": "#ec4899",
  "Petrol": "#eab308",
  "Vegetable and Groceries": "#84cc16",
  "Mobile": "#8b5cf6",
  "WiFi": "#14b8a6"
};

let allExpenses = [];
let budgetTargets = {};
let monthlyIncomeMap = {};
let recurringExpenses = [];
let categoryChartInstance = null;
let trendChartInstance = null;

// Helpers
const getMonthKey = (dateStr) => dateStr ? dateStr.substring(0, 7) : new Date().toISOString().substring(0, 7);
const getCurrentMonthKey = () => new Date().toISOString().substring(0, 7);

window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('currentMonthDisplay').textContent = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  document.getElementById('formDate').valueAsDate = new Date();
  await loadCoreData();
});

// Switch Navigation Tabs
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('tab-active', 'text-sky-400');
    btn.classList.add('text-slate-400');
  });

  document.getElementById(tabId).classList.remove('hidden');
  const activeBtn = document.getElementById(`btn-${tabId}`);
  activeBtn.classList.add('tab-active', 'text-sky-400');
  activeBtn.classList.remove('text-slate-400');

  if (tabId === 'historyTab') renderHistoricalView();
  if (tabId === 'insightsTab') renderInsightsView();
  if (tabId === 'recurringTab') renderRecurringCards();
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// Core Data Synchronization
async function loadCoreData() {
  try {
    const [expRes, bgtRes, incRes, recRes] = await Promise.all([
      client.from('expenses').select('*').order('date', { ascending: false }),
      client.from('budget_targets').select('*'),
      client.from('monthly_income').select('*'),
      client.from('recurring_expenses').select('*')
    ]);

    allExpenses = expRes.data || [];
    (bgtRes.data || []).forEach(b => { budgetTargets[b.category] = parseFloat(b.monthly_budget); });
    (incRes.data || []).forEach(i => { monthlyIncomeMap[i.month_year] = parseFloat(i.amount); });
    recurringExpenses = recRes.data || [];

    renderDashboard();
  } catch (err) {
    console.error("Initialization error:", err);
  }
}

// Monthly Income Prompt
async function promptUpdateIncome() {
  const currentKey = getCurrentMonthKey();
  const currentVal = monthlyIncomeMap[currentKey] || 0;
  const val = prompt("Enter total monthly take-home income (₹):", currentVal);
  if (val !== null && !isNaN(val) && val.trim() !== '') {
    const num = parseFloat(val);
    await client.from('monthly_income').upsert({ month_year: currentKey, amount: num });
    monthlyIncomeMap[currentKey] = num;
    renderDashboard();
  }
}

// 1. Dashboard View Engine
function renderDashboard() {
  const currentKey = getCurrentMonthKey();
  const currentExpenses = allExpenses.filter(e => getMonthKey(e.date) === currentKey);

  const totalIncome = monthlyIncomeMap[currentKey] || 0;
  const totalOutflow = currentExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const netSavings = totalIncome - totalOutflow;
  const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(1) : 0;

  // KPIs
  document.getElementById('kpiIncome').textContent = `₹${totalIncome.toLocaleString('en-IN')}`;
  document.getElementById('kpiOutflow').textContent = `₹${totalOutflow.toLocaleString('en-IN')}`;
  document.getElementById('kpiNetSavings').textContent = `₹${netSavings.toLocaleString('en-IN')}`;
  document.getElementById('kpiSavingsRate').textContent = `${savingsRate}%`;

  // Render Category Pie Chart
  renderCategoryPie(currentExpenses);

  // Render Payment Mode Breakdown
  renderPaymentModeSummary(currentExpenses);

  // Render Budget Comparison Table
  renderBudgetTable(currentExpenses);

  // Render Transactions Log
  renderTransactionsList(currentExpenses);
}

function renderCategoryPie(expenses) {
  const categoryTotals = {};
  Object.keys(CATEGORY_COLORS).forEach(c => categoryTotals[c] = 0);
  expenses.forEach(e => {
    if (categoryTotals[e.category] !== undefined) categoryTotals[e.category] += parseFloat(e.amount);
    else categoryTotals[e.category] = parseFloat(e.amount);
  });

  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);
  const colors = labels.map(l => CATEGORY_COLORS[l] || '#94a3b8');

  if (categoryChartInstance) categoryChartInstance.destroy();
  const ctx = document.getElementById('categoryPieChart').getContext('2d');
  categoryChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 1.5,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } }
      }
    }
  });
}

function renderPaymentModeSummary(expenses) {
  const modes = ['Cash/GPAY', 'Amazon Pay ICICI', 'SBI', 'HDFC Swiggy', 'Others'];
  const totals = {};
  modes.forEach(m => totals[m] = 0);
  expenses.forEach(e => {
    if (totals[e.paid_by] !== undefined) totals[e.paid_by] += parseFloat(e.amount);
    else totals['Others'] += parseFloat(e.amount);
  });

  const container = document.getElementById('modeBreakdownContainer');
  container.innerHTML = modes.map(mode => `
    <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
      <div class="flex items-center space-x-2">
        <i class="fa-solid fa-credit-card text-xs text-slate-500"></i>
        <span class="text-xs font-semibold text-slate-700">${mode}</span>
      </div>
      <span class="text-xs font-bold text-slate-900">₹${totals[mode].toLocaleString('en-IN')}</span>
    </div>
  `).join('');
}

function renderBudgetTable(expenses) {
  const actuals = {};
  Object.keys(budgetsDefault = {
    'Parents Expenses': 0, 'Home Expenses': 0, 'Home Loan EMI': 0,
    'Milk': 0, 'Non-veg': 0, 'Rachael': 0, 'Petrol': 0,
    'Vegetable and Groceries': 0, 'Mobile': 0, 'WiFi': 0
  }).forEach(k => actuals[k] = 0);

  expenses.forEach(e => {
    if (actuals[e.category] !== undefined) actuals[e.category] += parseFloat(e.amount);
  });

  const tbody = document.getElementById('budgetComparisonTableBody');
  tbody.innerHTML = Object.keys(actuals).map(cat => {
    const budget = budgetTargets[cat] || 0;
    const actual = actuals[cat] || 0;
    const remaining = budget - actual;
    const isOver = actual > budget;

    return `
      <tr class="hover:bg-slate-50/80">
        <td class="px-4 py-3 font-medium text-slate-800 flex items-center">
          <span class="w-2.5 h-2.5 rounded-full mr-2" style="background-color: ${CATEGORY_COLORS[cat] || '#cbd5e1'}"></span>
          ${cat}
        </td>
        <td class="px-4 py-3 text-right font-medium text-slate-600">₹${budget.toLocaleString('en-IN')}</td>
        <td class="px-4 py-3 text-right font-bold text-slate-900">₹${actual.toLocaleString('en-IN')}</td>
        <td class="px-4 py-3 text-right font-medium ${isOver ? 'text-rose-600' : 'text-emerald-600'}">
          ${isOver ? '-' : ''}₹${Math.abs(remaining).toLocaleString('en-IN')}
        </td>
        <td class="px-4 py-3 text-center">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${isOver ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}">
            ${isOver ? 'Over Budget' : 'On Track'}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function renderTransactionsList(expenses) {
  const container = document.getElementById('transactionListContainer');
  document.getElementById('txCountDisplay').textContent = `${expenses.length} records`;

  if (expenses.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">No recorded entries this billing cycle.</div>`;
    return;
  }

  container.innerHTML = expenses.map(e => `
    <div class="p-3.5 flex items-center justify-between hover:bg-slate-50 transition">
      <div class="space-y-1">
        <div class="flex items-center space-x-2">
          <span class="text-xs font-bold text-slate-800">${e.description}</span>
          <span class="px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-600 bg-slate-100">${e.category}</span>
        </div>
        <p class="text-[11px] text-slate-400">${e.date} • ${e.paid_by} ${e.notes ? `• ${e.notes}` : ''}</p>
      </div>
      <div class="flex items-center space-x-3">
        <div class="text-right">
          <div class="text-xs font-bold text-slate-900">₹${parseFloat(e.amount).toLocaleString('en-IN')}</div>
          <div class="flex space-x-1 justify-end mt-0.5">
            ${e.attachment_url ? `<button onclick="viewDocument('${e.attachment_url}')" class="text-[10px] text-sky-600 hover:underline"><i class="fa-solid fa-paperclip"></i> Receipt</button>` : ''}
            ${e.drive_link ? `<a href="${e.drive_link}" target="_blank" class="text-[10px] text-teal-600 hover:underline ml-1"><i class="fa-brands fa-google-drive"></i> Link</a>` : ''}
          </div>
        </div>
        <div class="flex items-center space-x-1 border-l pl-2">
          <button onclick="editExpense('${e.id}')" class="text-slate-400 hover:text-sky-600 text-xs p-1"><i class="fa-solid fa-pen"></i></button>
          <button onclick="deleteExpense('${e.id}')" class="text-slate-400 hover:text-rose-600 text-xs p-1"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>
  `).join('');
}

// 2. Historical Trends & Details
function renderHistoricalView() {
  const currentKey = getCurrentMonthKey();
  const pastExpenses = allExpenses.filter(e => getMonthKey(e.date) !== currentKey);

  // Group by month
  const monthlyTotals = {};
  allExpenses.forEach(e => {
    const k = getMonthKey(e.date);
    monthlyTotals[k] = (monthlyTotals[k] || 0) + parseFloat(e.amount);
  });

  const sortedMonths = Object.keys(monthlyTotals).sort();

  // Populate Dropdown
  const selector = document.getElementById('historyMonthSelector');
  selector.innerHTML = '<option value="">Choose Billing Month</option>' + sortedMonths.filter(m => m !== currentKey).map(m => `
    <option value="${m}">${m}</option>
  `).join('');

  // Line Chart
  if (trendChartInstance) trendChartInstance.destroy();
  const ctx = document.getElementById('trendChart').getContext('2d');
  trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedMonths,
      datasets: [{
        label: 'Monthly Spend (₹)',
        data: sortedMonths.map(m => monthlyTotals[m]),
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderHistoricalDetails() {
  const selected = document.getElementById('historyMonthSelector').value;
  const container = document.getElementById('historyDetailsContainer');

  if (!selected) {
    container.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">Select a prior month to view itemized records and totals.</p>`;
    return;
  }

  const items = allExpenses.filter(e => getMonthKey(e.date) === selected);
  const total = items.reduce((s, i) => s + parseFloat(i.amount), 0);

  container.innerHTML = `
    <div class="mb-3 p-3 bg-slate-50 rounded-lg flex justify-between items-center">
      <span class="text-xs font-bold text-slate-700">Total Spend in ${selected}</span>
      <span class="text-sm font-extrabold text-indigo-700">₹${total.toLocaleString('en-IN')}</span>
    </div>
    <div class="divide-y divide-slate-100 max-h-72 overflow-y-auto">
      ${items.map(e => `
        <div class="py-2 flex justify-between items-center text-xs">
          <div>
            <p class="font-medium text-slate-800">${e.description}</p>
            <span class="text-[10px] text-slate-400">${e.date} • ${e.category} •${e.paid_by}</span>
          </div>
          <span class="font-bold text-slate-700">₹${parseFloat(e.amount).toLocaleString('en-IN')}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// 3. Recurring Calendar & Cards
function renderRecurringCards() {
  const container = document.getElementById('recurringCardGrid');
  if (recurringExpenses.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 col-span-3">No recurring schedules registered.</p>`;
    return;
  }

  container.innerHTML = recurringExpenses.map(r => `
    <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-bold text-slate-800">${r.title}</span>
        <span class="text-[10px] font-semibold bg-sky-50 text-sky-700 px-2 py-0.5 rounded">Due day ${r.due_day}</span>
      </div>
      <div class="text-lg font-extrabold text-slate-900 mb-2">₹${parseFloat(r.amount).toLocaleString('en-IN')}</div>
      <div class="text-[11px] text-slate-400 flex justify-between items-center">
        <span>${r.category}</span>
        <span>${r.paid_by}</span>
      </div>
    </div>
  `).join('');
}

// 4. Insights Generation
function renderInsightsView() {
  const container = document.getElementById('insightsContainer');
  const currentKey = getCurrentMonthKey();
  const currentExpenses = allExpenses.filter(e => getMonthKey(e.date) === currentKey);

  // Group current by category
  const currTotals = {};
  currentExpenses.forEach(e => currTotals[e.category] = (currTotals[e.category] || 0) + parseFloat(e.amount));

  // Determine prior month
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const priorKey = d.toISOString().substring(0, 7);
  const priorExpenses = allExpenses.filter(e => getMonthKey(e.date) === priorKey);
  const priorTotals = {};
  priorExpenses.forEach(e => priorTotals[e.category] = (priorTotals[e.category] || 0) + parseFloat(e.amount));

  const insights = [];

  // Over budget checks
  Object.keys(budgetTargets).forEach(cat => {
    const budget = budgetTargets[cat] || 0;
    const spent = currTotals[cat] || 0;
    if (spent > budget && budget > 0) {
      insights.push({
        type: 'danger',
        icon: 'fa-triangle-exclamation',
        title: `Budget Limit Exceeded: ${cat}`,
        desc: `You have spent ₹${spent.toLocaleString('en-IN')}, exceeding your target of ₹${budget.toLocaleString('en-IN')} by ₹${(spent - budget).toLocaleString('en-IN')}.`
      });
    }
  });

  // Relative surges vs prior month
  Object.keys(currTotals).forEach(cat => {
    const curr = currTotals[cat];
    const prev = priorTotals[cat] || 0;
    if (prev > 0 && curr > prev * 1.25) {
      const surgePct = Math.round(((curr - prev) / prev) * 100);
      insights.push({
        type: 'warning',
        icon: 'fa-arrow-trend-up',
        title: `Spike in ${cat}`,
        desc: `Expenditure in ${cat} is up ${surgePct}% relative to last billing cycle (₹${curr.toLocaleString('en-IN')} vs ₹${prev.toLocaleString('en-IN')}).`
      });
    }
  });

  // Recurring bills coming up
  const currentDay = new Date().getDate();
  recurringExpenses.forEach(r => {
    if (r.due_day >= currentDay && r.due_day <= currentDay + 5) {
      insights.push({
        type: 'info',
        icon: 'fa-bell',
        title: `Bill Due Soon: ${r.title}`,
        desc: `Scheduled for day ${r.due_day} of this month for ₹${parseFloat(r.amount).toLocaleString('en-IN')} via ${r.paid_by}.`
      });
    }
  });

  if (insights.length === 0) {
    insights.push({
      type: 'success',
      icon: 'fa-circle-check',
      title: 'Healthy Financial Pace',
      desc: 'All categories remain within designated bounds, and no anomalous variances were detected this cycle.'
    });
  }

  container.innerHTML = insights.map(i => {
    const colorClass = {
      danger: 'bg-rose-50 border-rose-200 text-rose-800',
      warning: 'bg-amber-50 border-amber-200 text-amber-800',
      info: 'bg-sky-50 border-sky-200 text-sky-800',
      success: 'bg-emerald-50 border-emerald-200 text-emerald-800'
    }[i.type];

    return `
      <div class="p-4 rounded-xl border ${colorClass} flex space-x-3 items-start">
        <i class="fa-solid ${i.icon} text-sm mt-0.5"></i>
        <div>
          <h4 class="text-xs font-bold">${i.title}</h4>
          <p class="text-xs mt-0.5 opacity-90">${i.desc}</p>
        </div>
      </div>
    `;
  }).join('');
}

// 5. Expense Creation & Update Handler
async function handleExpenseSubmit(event) {
  event.preventDefault();
  const submitBtn = document.getElementById('btnSubmitExpense');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  const id = document.getElementById('formExpenseId').value;
  const description = document.getElementById('formDesc').value;
  const category = document.getElementById('formCategory').value;
  const paid_by = document.getElementById('formPaidBy').value;
  const amount = parseFloat(document.getElementById('formAmount').value);
  const date = document.getElementById('formDate').value;
  const notes = document.getElementById('formNotes').value;
  const drive_link = document.getElementById('formDriveLink').value;
  const receiptFile = document.getElementById('formReceiptFile').files[0];

  let attachment_url = null;

  try {
    if (receiptFile) {
      const fileName = `${Date.now()}_${receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
      const { data: uploadData, error: uploadErr } = await client.storage.from('receipts').upload(fileName, receiptFile);
      if (!uploadErr) {
        const { data: publicData } = client.storage.from('receipts').getPublicUrl(fileName);
        attachment_url = publicData.publicUrl;
      }
    }

    const payload = { description, category, paid_by, amount, date, notes, drive_link };
    if (attachment_url) payload.attachment_url = attachment_url;

    if (id) {
      await client.from('expenses').update(payload).eq('id', id);
    } else {
      await client.from('expenses').insert(payload);
    }

    closeModal('entryModal');
    document.getElementById('expenseForm').reset();
    document.getElementById('formExpenseId').value = '';
    await loadCoreData();
  } catch (err) {
    alert('Failed to save expense record: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Record';
  }
}

function editExpense(id) {
  const item = allExpenses.find(e => e.id === id);
  if (!item) return;

  document.getElementById('formExpenseId').value = item.id;
  document.getElementById('formDesc').value = item.description;
  document.getElementById('formCategory').value = item.category;
  document.getElementById('formPaidBy').value = item.paid_by;
  document.getElementById('formAmount').value = item.amount;
  document.getElementById('formDate').value = item.date;
  document.getElementById('formNotes').value = item.notes || '';
  document.getElementById('formDriveLink').value = item.drive_link || '';
  document.getElementById('entryModalTitle').textContent = 'Edit Expense Record';

  openModal('entryModal');
}

async function deleteExpense(id) {
  if (!confirm('Are you sure you want to remove this transaction?')) return;
  await client.from('expenses').delete().eq('id', id);
  await loadCoreData();
}

// 6. Recurring Expense Submission
async function handleRecurringSubmit(event) {
  event.preventDefault();
  const title = document.getElementById('recTitle').value;
  const category = document.getElementById('recCategory').value;
  const paid_by = document.getElementById('recPaidBy').value;
  const amount = parseFloat(document.getElementById('recAmount').value);
  const due_day = parseInt(document.getElementById('recDueDay').value);

  await client.from('recurring_expenses').insert({ title, category, paid_by, amount, due_day });
  closeModal('recurringModal');
  document.getElementById('recurringForm').reset();
  await loadCoreData();
  renderRecurringCards();
}

// 7. Statement Parser (PDF, Excel, Images)
async function processStatementUpload() {
  const cardType = document.getElementById('importCardType').value;
  const fileInput = document.getElementById('statementFileInput');
  const file = fileInput.files[0];

  if (!file) {
    alert("Please select a statement document or image.");
    return;
  }

  const statusEl = document.getElementById('importStatus');
  const statusText = document.getElementById('importStatusText');
  const processBtn = document.getElementById('btnProcessImport');

  statusEl.classList.remove('hidden');
  processBtn.disabled = true;

  try {
    let parsedItems = [];
    const ext = file.name.split('.').pop().toLowerCase();

    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      statusText.textContent = "Processing spreadsheet...";
      parsedItems = await parseExcelStatement(file, cardType);
    } else if (ext === 'pdf') {
      statusText.textContent = "Extracting text from PDF...";
      parsedItems = await parsePDFStatement(file, cardType);
    } else {
      statusText.textContent = "Running OCR on statement image...";
      parsedItems = await parseImageStatement(file, cardType);
    }

    if (parsedItems.length === 0) {
      alert("No line items could be parsed. Verify the document format.");
    } else {
      statusText.textContent = `Saving ${parsedItems.length} transactions...`;
      await client.from('expenses').insert(parsedItems);
      alert(`Successfully imported and categorized ${parsedItems.length} records.`);
      closeModal('statementModal');
      fileInput.value = '';
      await loadCoreData();
    }
  } catch (err) {
    console.error(err);
    alert("Statement parsing error: " + err.message);
  } finally {
    statusEl.classList.add('hidden');
    processBtn.disabled = false;
  }
}

// Automatic Categorization Engine
function autoDetectCategory(desc) {
  const text = desc.toLowerCase();
  if (text.includes('petrol') || text.includes('fuel') || text.includes('shell') || text.includes('hpcl') || text.includes('iocl') || text.includes('bpcl')) return 'Petrol';
  if (text.includes('milk') || text.includes('dairy') || text.includes('country delight') || text.includes('heritage') || text.includes('amul') || text.includes('nandini')) return 'Milk';
  if (text.includes('meat') || text.includes('chicken') || text.includes('fish') || text.includes('licious') || text.includes('fresh to home')) return 'Non-veg';
  if (text.includes('airtel') || text.includes('jio') || text.includes('vodafone') || text.includes('vi ') || text.includes('recharge')) return 'Mobile';
  if (text.includes('wifi') || text.includes('broadband') || text.includes('act ') || text.includes('hathway')) return 'WiFi';
  if (text.includes('emi') || text.includes('home loan') || text.includes('housing')) return 'Home Loan EMI';
  if (text.includes('rachael') || text.includes('school') || text.includes('tuition') || text.includes('stationery')) return 'Rachael';
  if (text.includes('grocery') || text.includes('vegetable') || text.includes('bigbasket') || text.includes('zepto') || text.includes('blinkit') || text.includes('instamart') || text.includes('dmart') || text.includes('supermarket')) return 'Vegetable and Groceries';
  if (text.includes('parents') || text.includes('father') || text.includes('mother') || text.includes('medicine') || text.includes('pharmacy') || text.includes('apollo')) return 'Parents Expenses';
  return 'Home Expenses';
}

// Excel Parser
async function parseExcelStatement(file, paidBy) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const records = [];

  for (let r of rows) {
    if (!r || r.length < 2) continue;
    const strRow = r.join(' ');
    const amtMatch = strRow.match(/(?:INR|Rs\.?|₹)?\s*([\d,]+\.\d{2})/i);
    if (amtMatch) {
      const amt = parseFloat(amtMatch[1].replace(/,/g, ''));
      if (amt > 0) {
        const desc = r.slice(0, 3).join(' ').replace(/[0-9]/g, '').trim() || "Card Charge";
        records.push({
          date: new Date().toISOString().substring(0, 10),
          description: desc.substring(0, 60),
          category: autoDetectCategory(desc),
          paid_by: paidBy,
          amount: amt,
          notes: 'Imported from spreadsheet statement'
        });
      }
    }
  }
  return records;
}

// PDF Statement Parser
async function parsePDFStatement(file, paidBy) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let fullText = "";

  for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(item => item.str).join(" ") + "\n";
  }

  return extractLineItemsFromText(fullText, paidBy);
}

// OCR Statement Parser
async function parseImageStatement(file, paidBy) {
  const { data: { text } } = await Tesseract.recognize(file, 'eng');
  return extractLineItemsFromText(text, paidBy);
}

// Extract records via regex lines
function extractLineItemsFromText(text, paidBy) {
  const lines = text.split('\n');
  const items = [];

  lines.forEach(line => {
    // Look for lines with currency values
    const match = line.match(/(.+?)\s+(?:INR|Rs\.?|₹)?\s*([\d,]+\.\d{2})/i);
    if (match) {
      const desc = match[1].replace(/[^a-zA-Z\s]/g, '').trim();
      const amt = parseFloat(match[2].replace(/,/g, ''));
      if (desc.length > 3 && amt > 0 && !desc.toLowerCase().includes('total') && !desc.toLowerCase().includes('balance')) {
        items.push({
          date: new Date().toISOString().substring(0, 10),
          description: desc.substring(0, 60),
          category: autoDetectCategory(desc),
          paid_by: paidBy,
          amount: amt,
          notes: 'Auto-extracted from statement'
        });
      }
    }
  });

  return items;
}

// 8. Document & Receipt Preview
function viewDocument(url) {
  const content = document.getElementById('previewContent');
  if (url.endsWith('.pdf')) {
    content.innerHTML = `<iframe src="${url}" class="w-full h-96 border rounded-lg"></iframe>`;
  } else {
    content.innerHTML = `<img src="${url}" class="max-h-[70vh] object-contain rounded-lg shadow-sm" alt="Document Receipt" />`;
  }
  openModal('previewModal');
}