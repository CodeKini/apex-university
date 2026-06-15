-- ============================================================
-- MIGRATION 002: Instructor Revenue & Payout Tracking
-- Run AFTER 001_course_builder.sql and 001_rls.sql
-- ============================================================

-- 1. Platform settings (key/value store for global config)
create table if not exists public.platform_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- Default platform commission: 30% to platform, 70% to instructor
insert into public.platform_settings (key, value) values
  ('platform_commission_pct', '30'),
  ('instructor_payout_pct',   '70')
on conflict (key) do nothing;

-- 2. Instructor commissions (one row per purchase)
create table if not exists public.instructor_commissions (
  id                        uuid primary key default uuid_generate_v4(),
  purchase_id               uuid not null references public.purchases(id) on delete cascade,
  instructor_id             uuid not null references public.profiles(id) on delete cascade,
  course_id                 uuid not null references public.courses(id) on delete cascade,
  -- money (all in cents)
  purchase_amount_cents     int  not null,
  platform_pct              numeric(5,2) not null,   -- snapshot e.g. 30.00
  instructor_pct            numeric(5,2) not null,   -- snapshot e.g. 70.00
  platform_fee_cents        int  not null,
  instructor_earnings_cents int  not null,
  currency                  text not null default 'usd',
  -- status workflow: pending → approved → paid  (or rejected)
  status                    text not null default 'pending'
    check (status in ('pending', 'approved', 'paid', 'rejected')),
  payout_id                 uuid,                    -- set when included in a payout batch
  rejection_reason          text,
  approved_at               timestamptz,
  paid_at                   timestamptz,
  rejected_at               timestamptz,
  created_at                timestamptz not null default now(),
  -- one commission per purchase (idempotent webhook)
  unique(purchase_id)
);

-- 3. Instructor payout batches (one row per payment sent to instructor)
create table if not exists public.instructor_payouts (
  id             uuid primary key default uuid_generate_v4(),
  instructor_id  uuid not null references public.profiles(id) on delete cascade,
  amount_cents   int  not null,
  currency       text not null default 'usd',
  method         text not null default 'bank'
    check (method in ('bank', 'paypal', 'stripe', 'check', 'crypto', 'other')),
  reference      text,          -- bank ref, PayPal transaction ID, etc.
  notes          text,
  paid_at        timestamptz,
  created_by     uuid not null references public.profiles(id),  -- admin who created it
  created_at     timestamptz not null default now()
);

-- 4. FK from commissions → payouts (added after both tables exist)
alter table public.instructor_commissions
  add constraint instructor_commissions_payout_id_fk
  foreign key (payout_id) references public.instructor_payouts(id) on delete set null;

-- 5. Indexes
create index if not exists commissions_instructor_id_idx on public.instructor_commissions(instructor_id);
create index if not exists commissions_course_id_idx     on public.instructor_commissions(course_id);
create index if not exists commissions_status_idx        on public.instructor_commissions(status);
create index if not exists commissions_payout_id_idx     on public.instructor_commissions(payout_id);
create index if not exists payouts_instructor_id_idx     on public.instructor_payouts(instructor_id);
