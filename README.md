# Finance Flow Dashboard

Mobile-first personal finance dashboard based on the supplied `MyExpenses.xlsx` workbook and supplied Finance Flow logo.

## Included
- Current-month dashboard: budget vs actual by category, budget/actual pie, KPI cards, payment-mode summary, recent entries.
- Manual expense entry with editing and bill attachment / Google Drive link.
- Statement import for PDF, Excel/CSV, PNG/JPG/WEBP. Imports become reviewable drafts and are not saved until confirmed.
- Historical tab excludes the current month and expands selected months.
- Recurring expense calendar.
- Insights tab for overspending, unusual charges, and upcoming recurring bills.
- Server-side data layer keeps service credentials out of frontend source files.
- Supabase SQL schema and workbook-derived budget/recurring seed data are included. No expense rows are seeded.

## Run locally
1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. In Supabase SQL Editor, run `supabase/schema.sql`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

The provided Supabase URL and anon key are placed only in the server environment configuration. The frontend uses `/api/*` endpoints and contains no database/Cloud Connected references.

## Production notes
The included RLS policies are intentionally simple for a prototype. Before public multi-user deployment, add Supabase Auth and user-scoped row policies. Create a Storage bucket named `bills` and make its access policy match your desired privacy model.
