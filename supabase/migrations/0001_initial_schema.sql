create type loan_status as enum ('active', 'extended', 'completed', 'overdue', 'draft', 'cancelled');
create type payment_status as enum ('paid', 'partial', 'missed', 'pending');
create type collection_type as enum ('Daily', 'Monthly', 'Lump Sum');
create type borrower_status as enum ('Active', 'Overdue', 'Completed');
create type activity_type as enum ('loan', 'payment', 'settlement', 'borrower', 'partner');

create table if not exists public.borrowers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  address text not null default '',
  barangay text not null default '',
  status borrower_status not null default 'Active',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null default '',
  share numeric(5, 2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  borrower_id uuid not null references public.borrowers (id) on delete cascade,
  partner_id uuid references public.partners (id) on delete set null,
  principal numeric(14, 2) not null,
  rate numeric(5, 2) not null,
  interest numeric(14, 2) not null,
  total_due numeric(14, 2) not null,
  paid numeric(14, 2) not null default 0,
  collection_type collection_type not null default 'Daily',
  target_days integer not null,
  max_days integer not null,
  loan_date date not null,
  target_date date not null,
  maturity_date date not null,
  status loan_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  borrower_id uuid not null references public.borrowers (id) on delete cascade,
  date date not null,
  expected numeric(14, 2) not null,
  paid numeric(14, 2) not null,
  method text not null default 'Cash',
  notes text not null default '',
  status payment_status not null default 'paid',
  created_at timestamptz not null default now()
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  amount numeric(14, 2) not null,
  date date not null,
  method text not null default 'Cash',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  type activity_type not null,
  message text not null,
  date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null default '',
  is_secret boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loans_borrower_id_idx on public.loans (borrower_id);
create index if not exists loans_status_idx on public.loans (status);
create index if not exists loans_partner_id_idx on public.loans (partner_id);
create index if not exists payments_loan_id_idx on public.payments (loan_id);
create index if not exists payments_date_idx on public.payments (date);
create index if not exists activities_date_idx on public.activities (date);

alter table public.borrowers enable row level security;
alter table public.partners enable row level security;
alter table public.loans enable row level security;
alter table public.payments enable row level security;
alter table public.settlements enable row level security;
alter table public.activities enable row level security;
alter table public.settings enable row level security;

create policy "borrowers_all" on public.borrowers
  for all to anon, authenticated using (true) with check (true);
create policy "partners_all" on public.partners
  for all to anon, authenticated using (true) with check (true);
create policy "loans_all" on public.loans
  for all to anon, authenticated using (true) with check (true);
create policy "payments_all" on public.payments
  for all to anon, authenticated using (true) with check (true);
create policy "settlements_all" on public.settlements
  for all to anon, authenticated using (true) with check (true);
create policy "activities_all" on public.activities
  for all to anon, authenticated using (true) with check (true);
create policy "settings_all" on public.settings
  for all to anon, authenticated using (true) with check (true);