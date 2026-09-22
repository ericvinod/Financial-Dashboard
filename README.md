
Finance Flow Dashboard - Supabase Connected

1. Run supabase_schema.sql in Supabase SQL Editor
2. Create Storage bucket 'bills' public
3. Deploy folder contents to any static host (Netlify, Vercel, Cloudflare Pages)
4. index.html = Supabase wrapper (uses your provided credentials)
   app.html = pure offline version (same UI, localStorage only)
   index_offline.html = backup offline

Credentials embedded:
SUPABASE_URL = https://ayxmhtojfwdcuodxmlzm.supabase.co
ANON_KEY = (provided)

Tables:
- budgets, expenses, recurring_expenses, emi_tracker

To enable bill uploads to Supabase Storage:
  await supabase.storage.from('bills').upload(fileName, file)
  then save URL in expenses.bill_url

The app automatically tries to fetch budgets from Supabase on load.
