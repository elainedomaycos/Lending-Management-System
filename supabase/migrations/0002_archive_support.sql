alter table partners
  add column if not exists archived_at timestamptz;

alter table borrowers
  add column if not exists archived_at timestamptz;

alter table loans
  add column if not exists archived_at timestamptz;

alter table payments
  add column if not exists archived_at timestamptz;

create index if not exists partners_archived_at_idx
  on partners (archived_at)
  where archived_at is not null;

create index if not exists borrowers_archived_at_idx
  on borrowers (archived_at)
  where archived_at is not null;

create index if not exists loans_archived_at_idx
  on loans (archived_at)
  where archived_at is not null;

create index if not exists payments_archived_at_idx
  on payments (archived_at)
  where archived_at is not null;