# Finance Flow Dashboard

A mobile-friendly household budget dashboard: budget vs actual, spend by payment
mode, a spending history with trends, a recurring-bills calendar, and simple
overspending alerts. Data is stored in your project so it's there next time
you open the app.

## 1. One-time database setup

1. Open your project's SQL editor.
2. Paste in the contents of `schema.sql` and run it once.
   This creates the tables, seeds your original budget/income/recurring-bill
   numbers, and sets up a storage bucket for attached bills.

The connection details are already filled in inside `js/config.js`.

## 2. Hosting the site

This is a static site — no build step. Upload the whole folder as-is to any
static host (Netlify, Vercel, GitHub Pages, S3, your own server, etc.) and
point it at `index.html`.

## 3. Using it

- **Dashboard** — this month's income, outflow, net cash flow, savings rate,
  budget vs actual (with the pie charts and colored bars), and spend by
  payment mode. Tap **+** to add an entry, or **Import** to read a card
  statement (PDF, Excel, or a photo) — you'll always get a chance to review
  and edit what was found before it's saved. Tap any entry to edit or delete
  it, and tap the income card to add or adjust income sources.
- **History** — once a month has passed, it shows up here automatically with
  a spending trend line, a category breakdown, and a week-by-week chart.
  Nothing needs to be done manually — it's populated from the entries you add
  over time.
- **Recurring** — a monthly calendar of insurance and other recurring bills,
  plus your running credit-card EMIs.
- **Insights** — overspending alerts, bills due soon, unusual charges, and
  month-over-month takeaways.

## 4. Adding the app to a phone's home screen

Open the hosted site in Chrome or Safari and use "Add to Home Screen" — the
Finance Flow icon and name will be used automatically (via `manifest.json`
and the icons in `assets/`).

## Notes on statement imports

Reading PDFs and photos of statements is done entirely in the browser
(no data leaves the device except to save the entries you confirm). It uses
pattern matching, so always check the review screen — dates, categories, or
amounts can occasionally need a correction, especially on photos.
