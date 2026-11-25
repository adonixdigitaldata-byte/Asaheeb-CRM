-- ============================================================
-- COMMISSION CASH FLOW TRACKING (DEVELOPER INFLOW & AGENT OUTFLOW)
-- Safe, additive migration: zero impact on existing sales & celebrations
-- ============================================================

-- 1. Add cash flow summary columns to project_commissions
alter table project_commissions add column if not exists expected_payout_date date;
alter table project_commissions add column if not exists developer_received_amount numeric(14, 2) not null default 0;
alter table project_commissions add column if not exists developer_payment_status text not null default 'PENDING' check (developer_payment_status in ('PENDING', 'PARTIAL', 'RECEIVED'));
alter table project_commissions add column if not exists agent_commission_amount numeric(14, 2) not null default 0;
alter table project_commissions add column if not exists agent_paid_amount numeric(14, 2) not null default 0;
alter table project_commissions add column if not exists agent_payout_status text not null default 'UNPAID' check (agent_payout_status in ('UNPAID', 'PARTIAL', 'PAID'));
alter table project_commissions add column if not exists claim_sent_at timestamptz;

-- 2. Create commission_payments ledger table for partial tranches & disbursements
-- Supports both deal-level payments (commission_id set) and monthly target-adjusted agent payouts (recipient_id + payout_month set)
create table if not exists commission_payments (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid references project_commissions(id) on delete cascade,
  direction text not null check (direction in ('INFLOW', 'OUTFLOW')), -- INFLOW: Developer -> Asaheeb, OUTFLOW: Asaheeb -> Agent/Manager
  recipient_id uuid references profiles(id) on delete set null,
  payout_month text, -- e.g. '2026-11' for monthly target-adjusted disbursements
  amount numeric(14, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null default 'BANK_TRANSFER',
  reference_no text,
  notes text,
  recorded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Safe alterations in case table was already created earlier
alter table commission_payments alter column commission_id drop not null;
alter table commission_payments add column if not exists payout_month text;

create index if not exists idx_commission_payments_commission on commission_payments(commission_id);
create index if not exists idx_commission_payments_recipient on commission_payments(recipient_id, payout_month);
create index if not exists idx_commission_payments_direction on commission_payments(direction);
create index if not exists idx_commission_payments_date on commission_payments(payment_date desc);

alter table commission_payments enable row level security;

drop policy if exists "Admins manage all commission payments" on commission_payments;
create policy "Admins manage all commission payments" on commission_payments
  for all using (is_admin());

drop policy if exists "Staff can view payments for own deals" on commission_payments;
create policy "Staff can view payments for own deals" on commission_payments
  for select using (
    recipient_id = auth.uid()
    or exists (
      select 1 from project_commissions pc
      where pc.id = commission_payments.commission_id
        and (pc.agent_id = auth.uid() or pc.created_by = auth.uid())
    )
  );
