create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users_all" on public.users
  for all to anon, authenticated using (true) with check (true);

-- Default owner seeded with scrypt hash of PIN "1234".
-- Format: scrypt$N$r$p$<salt b64>$<hash b64>
insert into public.users (name, pin_hash)
values ('Divine Valdez', 'scrypt$16384$8$1$scZUUAV99+fltST4/KI4pA==$W8XJIkqanE1PeiMV1ksi4VT1Nj8tlTdSLd/WfEQWCy7FxZP1of3Cgr6IEJcg6tgyluR5vVtaPi6Bzo4KIR9FLw==')
on conflict do nothing;