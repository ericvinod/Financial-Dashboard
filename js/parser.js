// Best-effort statement reader. It turns a PDF / Excel / photo of a
// statement into a list of draft entries the person reviews and edits
// before anything is saved — nothing here writes to storage on its own.

const CATEGORY_KEYWORDS = [
  [/loan|emi|home loan/i, "Home Loan EMI"],
  [/milk|dairy/i, "Milk"],
  [/petrol|fuel|diesel|hpcl|iocl|bharat petroleum|shell/i, "Petrol"],
  [/veg(etable)?s?\b|grocery|groceries|bigbasket|zepto|blinkit|kirana/i, "Vegetable and Groceries"],
  [/chicken|mutton|fish|egg|non.?veg|meat/i, "Non-veg"],
  [/jio|airtel|vi\b|vodafone|recharge|mobile/i, "Mobile"],
  [/wifi|broadband|act fibernet|fibernet|internet/i, "WiFi"],
  [/school|tuition|class|theatre|theater|phonics|rachael|toy/i, "Rachael"],
  [/rent|maintenance|iron|ironing|electricity|gas cylinder|utility/i, "Home Expenses"],
  [/parents|veena|vinod|medicine|pharmeasy|pharmacy/i, "Parents Expenses"]
];

function guessCategory(text) {
  for (const [re, cat] of CATEGORY_KEYWORDS) if (re.test(text)) return cat;
  return "Home Expenses";
}

// Matches "12-08-2026 SOME MERCHANT TEXT 1,234.50 Dr. 14 14184731013" style
// lines (ICICI). The suffix (Dr/Cr) is REQUIRED right after the amount, so
// the amount can never be confused with trailing reward points or a
// reference number that follow it on the same line.
const ICICI_LINE_RE = /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2}|[\d,]+)\s*(Dr|Cr)\.?\b/i;

// Matches "15/08/2026 SOME MERCHANT TEXT 618.00" style lines (HDFC), where a
// plain debit has no suffix at all and only credits/cashback end in " Cr".
// Anchored to the end of the line since, unlike ICICI, nothing trails the
// amount here.
const HDFC_LINE_RE = /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(Cr)?\s*$/i;

// Matches "12 Sep 26 SOME MERCHANT TEXT 1,234.50 D" style lines (SBI), where
// the suffix is a single letter: D = debit, M = EMI/installment charge,
// C = credit/payment (skipped).
const SBI_LINE_RE = /(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2})\s+(.+?)\s+([\d,]+\.\d{2}|[\d,]+)\s*\b([CDM])\b/;

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function normalizeDate(raw) {
  const parts = raw.split(/[\/\-.]/).map(p => p.trim());
  let [a, b, c] = parts;
  if (c.length === 2) c = (Number(c) > 50 ? "19" : "20") + c;
  // Assume day/month/year (common on Indian statements)
  let day = a, month = b, year = c;
  if (Number(a) > 31) { year = a; month = b; day = c; } // yyyy/mm/dd fallback
  day = day.padStart(2, "0");
  month = month.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateSbi(dd, mon, yy) {
  const m = MONTHS[mon.slice(0, 3).toLowerCase()];
  if (!m) throw new Error("Unrecognized month");
  return `20${yy}-${String(m).padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

// Bank statement tables sometimes wrap a single transaction's description
// across two or three lines of extracted text. Re-join everything under a
// date-starting line until we hit a line that actually contains an
// amount+suffix, so the regexes above always see one complete row.
function mergeWrappedLines(lines) {
  const startsWithDate = l => /^\s*\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/.test(l) || /^\s*\d{1,2}\s+[A-Za-z]{3}\s+\d{2}\b/.test(l);
  const hasAmountSuffix = l => /[\d,]+\.\d{2}\s*(Dr|Cr)\b/i.test(l) || /[\d,]+\.\d{2}\s*\b[CDM]\b/.test(l) || /[\d,]+\.\d{2}\s*$/.test(l);
  const merged = [];
  let buffer = "";
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (startsWithDate(line)) {
      if (buffer) merged.push(buffer);
      buffer = line;
    } else if (buffer) {
      buffer += " " + line;
    } else {
      continue;
    }
    if (buffer && hasAmountSuffix(buffer)) { merged.push(buffer); buffer = ""; }
  }
  if (buffer) merged.push(buffer);
  return merged;
}

function makeDraftEntry(entry_date, rawDesc, amount, paidBy, source) {
  return {
    entry_date,
    description: rawDesc.trim().replace(/\s{2,}/g, " "),
    category: guessCategory(rawDesc),
    paid_by: paidBy,
    amount,
    notes: "",
    source
  };
}

function linesToEntries(lines, paidBy, source) {
  const out = [];
  for (const line of mergeWrappedLines(lines)) {
    let m = line.match(ICICI_LINE_RE);
    if (m) {
      const [, dateRaw, desc, amtRaw, suffix] = m;
      if (/^cr$/i.test(suffix)) continue; // skip payments/credits/refunds
      const amount = parseFloat(amtRaw.replace(/,/g, ""));
      if (!amount || amount <= 0) continue;
      let entry_date;
      try { entry_date = normalizeDate(dateRaw); } catch { continue; }
      out.push(makeDraftEntry(entry_date, desc, amount, paidBy, source));
      continue;
    }
    m = line.match(SBI_LINE_RE);
    if (m) {
      const [, dd, mon, yy, desc, amtRaw, suffix] = m;
      if (suffix === "C") continue; // skip payments/credits
      const amount = parseFloat(amtRaw.replace(/,/g, ""));
      if (!amount || amount <= 0) continue;
      let entry_date;
      try { entry_date = normalizeDateSbi(dd, mon, yy); } catch { continue; }
      out.push(makeDraftEntry(entry_date, desc, amount, paidBy, source));
      continue;
    }
    m = line.match(HDFC_LINE_RE);
    if (m) {
      const [, dateRaw, desc, amtRaw, suffix] = m;
      if (suffix) continue; // "Cr" = cashback/credit, skip
      const amount = parseFloat(amtRaw.replace(/,/g, ""));
      if (!amount || amount <= 0) continue;
      let entry_date;
      try { entry_date = normalizeDate(dateRaw); } catch { continue; }
      out.push(makeDraftEntry(entry_date, desc, amount, paidBy, source));
    }
  }
  return out;
}

async function parsePdfStatement(file, paidBy, source) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let allLines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Group text items into rough lines by their y position.
    const rows = {};
    content.items.forEach(it => {
      const y = Math.round(it.transform[5]);
      (rows[y] = rows[y] || []).push(it.str);
    });
    const lines = Object.keys(rows).sort((a, b) => b - a).map(y => rows[y].join(" "));
    allLines = allLines.concat(lines);
  }
  return linesToEntries(allLines, paidBy, source);
}

async function parseImageStatement(file, paidBy, source, onProgress) {
  const { data } = await Tesseract.recognize(file, "eng", {
    logger: m => { if (onProgress && m.status === "recognizing text") onProgress(Math.round(m.progress * 100)); }
  });
  const lines = data.text.split("\n");
  return linesToEntries(lines, paidBy, source);
}

async function parseExcelStatement(file, paidBy, source) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const out = [];
  wb.SheetNames.forEach(name => {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
    // Find the header row (has both a date-like and amount-like column)
    let headerIdx = -1, dateCol = -1, descCol = -1, amtCol = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const row = rows[i] || [];
      const lower = row.map(c => (c || "").toString().toLowerCase());
      const d = lower.findIndex(c => c.includes("date"));
      const a = lower.findIndex(c => c.includes("amount") || c.includes("debit"));
      const desc = lower.findIndex(c => c.includes("desc") || c.includes("narration") || c.includes("particular"));
      if (d !== -1 && a !== -1) { headerIdx = i; dateCol = d; amtCol = a; descCol = desc; break; }
    }
    if (headerIdx === -1) return;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const amtRaw = (row[amtCol] || "").toString().replace(/,/g, "");
      const amount = parseFloat(amtRaw);
      if (!amount || amount <= 0) continue;
      const dateRaw = (row[dateCol] || "").toString();
      let entry_date;
      try { entry_date = /^\d{4}-\d{2}-\d{2}/.test(dateRaw) ? dateRaw.slice(0, 10) : normalizeDate(dateRaw); }
      catch { continue; }
      const description = (descCol !== -1 ? row[descCol] : row.filter((_, ci) => ci !== dateCol && ci !== amtCol).join(" ")) || "Statement entry";
      out.push({
        entry_date,
        description: description.toString().trim(),
        category: guessCategory(description.toString()),
        paid_by: paidBy,
        amount,
        notes: "",
        source
      });
    }
  });
  return out;
}

async function parseStatement(file, paidBy, source, onProgress) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "pdf") return parsePdfStatement(file, paidBy, source);
  if (["xlsx", "xls", "csv"].includes(ext)) return parseExcelStatement(file, paidBy, source);
  if (["png", "jpg", "jpeg"].includes(ext)) return parseImageStatement(file, paidBy, source, onProgress);
  throw new Error("Unsupported file type. Use a PDF, Excel, or image file.");
}
