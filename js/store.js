// Thin wrapper so the rest of the app never talks about the storage layer
// directly. Every function returns plain JS values/arrays and throws a
// plain Error with a friendly message on failure.

const Store = {
  async listExpenses(month) {
    const { data, error } = await db.from("expenses").select("*").eq("month", month).order("entry_date", { ascending: false });
    if (error) throw new Error("Could not load entries.");
    return data || [];
  },

  async listAllExpenses() {
    const { data, error } = await db.from("expenses").select("*").order("entry_date", { ascending: true });
    if (error) throw new Error("Could not load entries.");
    return data || [];
  },

  async addExpense(entry) {
    const row = {
      id: uid(),
      entry_date: entry.entry_date,
      month: entry.entry_date.slice(0, 7),
      description: entry.description,
      category: entry.category,
      paid_by: entry.paid_by,
      amount: entry.amount,
      notes: entry.notes || null,
      bill_url: entry.bill_url || null,
      bill_type: entry.bill_type || null,
      source: entry.source || "manual"
    };
    const { error } = await db.from("expenses").insert(row);
    if (error) throw new Error("Could not save the entry.");
    return row;
  },

  async addExpenses(entries) {
    const rows = entries
      .filter(e => e && e.entry_date && e.description && e.category && e.paid_by && Number(e.amount) > 0)
      .map(e => ({
        id: uid(),
        entry_date: e.entry_date,
        month: e.entry_date.slice(0, 7),
        description: e.description,
        category: e.category,
        paid_by: e.paid_by,
        amount: Number(e.amount),
        notes: e.notes || null,
        bill_url: e.bill_url || null,
        bill_type: e.bill_type || null,
        source: e.source || "manual"
      }));
    if (!rows.length) throw new Error("None of these rows have a date, description and amount — nothing to save.");
    const { error } = await db.from("expenses").insert(rows);
    if (error) throw new Error("Could not save the imported entries: " + error.message);
    return rows;
  },

  async updateExpense(id, patch) {
    if (patch.entry_date) patch.month = patch.entry_date.slice(0, 7);
    patch.updated_at = new Date().toISOString();
    const { error } = await db.from("expenses").update(patch).eq("id", id);
    if (error) throw new Error("Could not update the entry.");
  },

  async deleteExpense(id) {
    const { error } = await db.from("expenses").delete().eq("id", id);
    if (error) throw new Error("Could not delete the entry.");
  },

  async uploadBill(file) {
    const path = `${Date.now()}-${file.name}`.replace(/\s+/g, "_");
    const { error } = await db.storage.from("bills").upload(path, file);
    if (error) throw new Error("Could not attach the file.");
    const { data } = db.storage.from("bills").getPublicUrl(path);
    return data.publicUrl;
  },

  async getBudgets() {
    const { data, error } = await db.from("budgets").select("*");
    if (error) throw new Error("Could not load the budget.");
    const map = {};
    (data || []).forEach(r => (map[r.category] = Number(r.amount)));
    CATEGORIES.forEach(c => { if (!(c in map)) map[c] = 0; });
    return map;
  },

  async setBudget(category, amount) {
    const { error } = await db.from("budgets").upsert({ category, amount }, { onConflict: "category" });
    if (error) throw new Error("Could not update the budget.");
  },

  async getIncome(month) {
    const { data, error } = await db.from("income").select("*").eq("month", month);
    if (error) throw new Error("Could not load income.");
    return data || [];
  },

  async addIncome(month, source, amount) {
    const row = { id: uid(), month, source, amount };
    const { error } = await db.from("income").insert(row);
    if (error) throw new Error("Could not save income.");
    return row;
  },

  async updateIncome(id, patch) {
    const { error } = await db.from("income").update(patch).eq("id", id);
    if (error) throw new Error("Could not update income.");
  },

  async deleteIncome(id) {
    const { error } = await db.from("income").delete().eq("id", id);
    if (error) throw new Error("Could not delete income.");
  },

  async listRecurring() {
    const { data, error } = await db.from("recurring_expenses").select("*").order("next_due", { ascending: true });
    if (error) throw new Error("Could not load recurring bills.");
    return data || [];
  },

  async addRecurring(row) {
    row.id = uid();
    const { error } = await db.from("recurring_expenses").insert(row);
    if (error) throw new Error("Could not save the recurring bill.");
    return row;
  },

  async updateRecurring(id, patch) {
    const { error } = await db.from("recurring_expenses").update(patch).eq("id", id);
    if (error) throw new Error("Could not update the recurring bill.");
  },

  async deleteRecurring(id) {
    const { error } = await db.from("recurring_expenses").delete().eq("id", id);
    if (error) throw new Error("Could not delete the recurring bill.");
  },

  async listCreditEmi() {
    const { data, error } = await db.from("credit_emi").select("*");
    if (error) throw new Error("Could not load EMI details.");
    return data || [];
  },

  async getUnbilledAmounts() {
    const { data, error } = await db.from("unbilled_amounts").select("*");
    if (error) throw new Error("Could not load unbilled amounts.");
    const map = {};
    (data || []).forEach(r => (map[r.card] = Number(r.amount)));
    return map;
  },

  async setUnbilledAmount(card, amount) {
    const { error } = await db.from("unbilled_amounts").upsert(
      { card, amount, updated_at: new Date().toISOString() },
      { onConflict: "card" }
    );
    if (error) throw new Error("Could not save the unbilled amount.");
  }
};
