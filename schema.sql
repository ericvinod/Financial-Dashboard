-- Finance Flow Dashboard — one-time setup
-- Run this once in your Supabase project's SQL editor (Project → SQL Editor → New query).

create extension if not exists pgcrypto;

-- Household income entries (editable per month)
create table if not exists income (
  id uuid primary key default gen_random_uuid(),
  month text not null,                 -- 'YYYY-MM'
  source text not null,
  amount numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Monthly budget baseline, one row per category
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  category text not null unique,
  amount numeric not null default 0
);

-- Every expense entry (manual or imported from a statement)
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  month text not null,                 -- 'YYYY-MM', derived from entry_date
  description text not null,
  category text not null,
  paid_by text not null,
  amount numeric not null,
  notes text,
  bill_url text,                       -- storage path or a Google Drive link
  bill_type text,                      -- 'pdf' | 'image' | 'drive_link'
  source text default 'manual',        -- 'manual' | 'sbi' | 'amazon_pay_icici' | 'hdfc_swiggy'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_month_idx on expenses(month);
create index if not exists expenses_category_idx on expenses(category);

-- Recurring bills / insurance premiums shown on the calendar tab
create table if not exists recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  next_due date,
  person text,
  frequency text,               -- 'Monthly' | 'Yearly' | ...
  premium_amount numeric,
  monthly_amount numeric,
  sum_insured text
);

-- Running credit-card EMIs (informational, shown on the calendar tab)
create table if not exists credit_emi (
  id uuid primary key default gen_random_uuid(),
  card text not null,
  product text not null,
  emi_no text,
  emi_amount numeric
);

alter table income enable row level security;
alter table budgets enable row level security;
alter table expenses enable row level security;
alter table recurring_expenses enable row level security;
alter table credit_emi enable row level security;

-- Single-user setup: allow the anon key full access.
-- Tighten these policies if you add real authentication later.
create policy "anon full access" on income for all using (true) with check (true);
create policy "anon full access" on budgets for all using (true) with check (true);
create policy "anon full access" on expenses for all using (true) with check (true);
create policy "anon full access" on recurring_expenses for all using (true) with check (true);
create policy "anon full access" on credit_emi for all using (true) with check (true);

-- Seed the budget baseline (from your original tracker)
insert into budgets (category, amount) values
  ('Home Loan EMI', 32000),
  ('Parents Expenses', 39500),
  ('Home Expenses', 3000),
  ('Milk', 700),
  ('Non-veg', 4000),
  ('Rachael', 9800),
  ('Petrol', 8000),
  ('Vegetable and Groceries', 18000),
  ('Mobile', 1692),
  ('WiFi', 1200),
  ('NOT Budgeted', 0)
on conflict (category) do nothing;

-- Seed this month's income baseline
insert into income (month, source, amount)
values (to_char(current_date, 'YYYY-MM'), 'Salary', 217000);

-- Seed recurring bills from your tracker
insert into recurring_expenses (name, next_due, person, frequency, premium_amount, monthly_amount, sum_insured) values
  ('LIC - Term Insurance - Amulya Jeevan', '2026-11-16', 'Savariraj Eric Vinod R', 'Yearly', 20250, 1688, '50 lakhs'),
  ('Max Life Term Insurance', '2026-11-29', 'Josephine Veena', 'Yearly', 13490, 5266, '1 Crore'),
  ('New India Assurance - Health Insurance', '2026-08-29', 'Savariraj Eric Vinod R, Rachael Antonia Kayal', 'Yearly', 14574, 1215, '5 lakhs'),
  ('Car Insurance', '2026-08-04', 'Josephine Veena', 'Yearly', 5076, 423, '8 Lakhs'),
  ('Bike Insurance', null, null, 'Yearly', null, null, null);

-- Seed running credit-card EMIs
insert into credit_emi (card, product, emi_no, emi_amount) values
  ('ICICI', 'Eric''s phone', '21 of 24', 1113),
  ('ICICI', 'Gadget', '06 of 06', 2146),
  ('SBI', '1 AC', '04 of 06', 7154),
  ('SBI', '2 AC', '04 of 06', 6537);

-- Storage bucket for attached bills (run once; skip if it already exists)
insert into storage.buckets (id, name, public)
values ('bills', 'bills', true)
on conflict (id) do nothing;

create policy "anon read bills" on storage.objects for select using (bucket_id = 'bills');
create policy "anon write bills" on storage.objects for insert with check (bucket_id = 'bills');
create policy "anon update bills" on storage.objects for update using (bucket_id = 'bills');
