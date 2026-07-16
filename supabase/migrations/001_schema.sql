-- ============================================================================
-- InvoiceMemory — v1 Production Schema (Supabase / PostgreSQL 15+)
-- ============================================================================
-- KERNEL: the `invoicememory_invoices` table. Everything else exists to make creating an
-- invoice instant: `invoicememory_clients` is the memory, `invoicememory_profiles` holds smart defaults,
-- `invoicememory_subscriptions`/`invoicememory_payments` hold Stripe billing state.
--
-- Design decisions (delete-first):
--   * No `plans` table — plan is an enum with per-user free provisioning
--     via handle_new_user_invoicememory(). No `invoice_items` table — line items are JSONB
--     (no cross-invoice relational queries needed in v1; GIN index covers
--     "remember my line items" suggestions).
--   * Money is ALWAYS integer cents (bigint). Never floats in finance.
--   * `service_role` bypasses RLS by design — Stripe webhooks and admin jobs
--     use it; no policies are written for it.
--
-- Run top-to-bottom as `postgres` (Supabase SQL editor / migration).
-- ============================================================================


-- ============================================================================
-- 1. ENUMS — reference data lives here, not in lookup tables
-- ============================================================================

create type public.user_role as enum ('user', 'admin');

create type public.subscription_plan as enum ('free', 'pro', 'business');

-- Mirrors Stripe subscription statuses exactly, so webhook payloads map 1:1.
create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused'
);

create type public.invoice_status as enum (
  'draft',
  'sent',
  'viewed',
  'paid',
  'overdue',
  'void'
);

-- Mirrors Stripe PaymentIntent lifecycle.
create type public.payment_status as enum (
  'pending',
  'processing',
  'succeeded',
  'failed',
  'refunded'
);


-- ============================================================================
-- 2. TABLES (5 total — v1 constraint)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 invoicememory_profiles — extends auth.users; holds the "smart defaults" memory
-- ----------------------------------------------------------------------------
create table public.invoicememory_profiles (
  id                         uuid primary key references auth.users (id) on delete cascade,
  email                      text not null,
  full_name                  text,
  business_name              text,
  business_address           text,
  default_currency           text not null default 'USD'
                               check (default_currency ~ '^[A-Z]{3}$'),
  default_payment_terms_days integer not null default 30
                               check (default_payment_terms_days between 0 and 365),
  -- Last used per-user invoice sequence; bumped atomically by trigger.
  invoice_seq                integer not null default 0,
  role                       public.user_role not null default 'user',
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

comment on table public.invoicememory_profiles is
  'One row per auth.users row, auto-created by handle_new_user_invoicememory(). Holds business defaults that pre-fill every new invoice.';
comment on column public.invoicememory_profiles.invoice_seq is
  'Last used invoice sequence number for this user. Only mutated by handle_invoice_insert().';

-- ----------------------------------------------------------------------------
-- 2.2 invoicememory_clients — the memory: people/companies the user invoicememory_invoices
-- ----------------------------------------------------------------------------
create table public.invoicememory_clients (
  id                 uuid default gen_random_uuid() primary key,
  user_id            uuid not null default auth.uid()
                       references public.invoicememory_profiles (id) on delete cascade,
  name               text not null check (btrim(name) <> ''),
  email              text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  company            text,
  address            text,
  -- NULL means "use profile default" — resolved at the app/service layer.
  currency           text check (currency is null or currency ~ '^[A-Z]{3}$'),
  payment_terms_days integer check (payment_terms_days is null
                                    or payment_terms_days between 0 and 365),
  notes              text,
  -- Soft delete: archived invoicememory_clients keep invoice history intact.
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.invoicememory_clients is
  'Saved billing contacts. This is the "memory" — invoicememory_invoices auto-fill from here.';

-- ----------------------------------------------------------------------------
-- 2.3 invoicememory_invoices — THE KERNEL
-- ----------------------------------------------------------------------------
create table public.invoicememory_invoices (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid not null default auth.uid()
                   references public.invoicememory_profiles (id) on delete cascade,
  -- SET NULL (not CASCADE/RESTRICT): deleting a client must never destroy or
  -- block financial records. The snapshot below preserves display data.
  client_id      uuid references public.invoicememory_clients (id) on delete set null,
  -- Immutable snapshot of the client name at issue time (finance best
  -- practice). Auto-filled from client_id by handle_invoice_insert().
  client_name    text not null,
  -- Auto-generated as INV-0001, INV-0002, ... per user when not provided.
  invoice_number text not null,
  status         public.invoice_status not null default 'draft',
  currency       text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  issue_date     date not null default current_date,
  due_date       date not null default (current_date + 30),
  -- Shape: [{"description": text, "quantity": numeric, "unit_price_cents": int}]
  line_items     jsonb not null default '[]'::jsonb
                   check (jsonb_typeof(line_items) = 'array'),
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  tax_cents      bigint not null default 0 check (tax_cents >= 0),
  -- Cannot drift from its parts — computed by the database, always.
  total_cents    bigint generated always as (subtotal_cents + tax_cents) stored,
  notes          text,
  sent_at        timestamptz,
  paid_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint invoices_due_after_issue        check (due_date >= issue_date),
  constraint invoices_unique_number_per_user unique (user_id, invoice_number)
);

comment on table public.invoicememory_invoices is
  'The kernel. Line items are embedded JSONB (v1); totals are integer cents.';

-- ----------------------------------------------------------------------------
-- 2.4 invoicememory_subscriptions — Stripe recurring billing state (one row per user)
-- ----------------------------------------------------------------------------
create table public.invoicememory_subscriptions (
  id                     uuid default gen_random_uuid() primary key,
  user_id                uuid not null references public.invoicememory_profiles (id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  plan                   public.subscription_plan not null default 'free',
  status                 public.subscription_status not null default 'active',
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- Exactly one billing-state row per user; also serves as the FK index.
  constraint subscriptions_one_per_user unique (user_id)
);

comment on table public.invoicememory_subscriptions is
  'Written ONLY by the Stripe webhook handler via service_role (bypasses RLS). Users get read-only access to their own row.';

-- ----------------------------------------------------------------------------
-- 2.5 invoicememory_payments — Stripe one-time charges (e.g. credit packs, lifetime deals)
-- ----------------------------------------------------------------------------
create table public.invoicememory_payments (
  id                       uuid default gen_random_uuid() primary key,
  user_id                  uuid not null references public.invoicememory_profiles (id) on delete cascade,
  stripe_payment_intent_id text unique,
  amount_cents             bigint not null check (amount_cents > 0),
  currency                 text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status                   public.payment_status not null default 'pending',
  description              text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.invoicememory_payments is
  'One-time Stripe charges. Written ONLY via service_role webhooks; users read their own history.';


-- ============================================================================
-- 3. COLUMN-LEVEL PRIVILEGES — defense in depth on top of RLS
-- ============================================================================

-- Users must never touch: role (privilege escalation), email (owned by auth),
-- invoice_seq (owned by trigger). Grant UPDATE only on safe profile columns.
revoke insert, update, delete on public.invoicememory_profiles from anon, authenticated;
grant update (full_name, business_name, business_address,
              default_currency, default_payment_terms_days)
  on public.invoicememory_profiles to authenticated;

-- Billing tables are write-only for the service role (webhooks).
revoke insert, update, delete on public.invoicememory_subscriptions from anon, authenticated;
revoke insert, update, delete on public.invoicememory_payments      from anon, authenticated;


-- ============================================================================
-- 4. INDEXES — every FK, every hot WHERE clause, partial where it pays off
-- ============================================================================

-- invoicememory_profiles
create index idx_profiles_email on public.invoicememory_profiles (email);

-- invoicememory_clients
create index idx_clients_user_id on public.invoicememory_clients (user_id);
-- Active-client autocomplete: the single hottest query in the product.
create index idx_clients_active_name
  on public.invoicememory_clients (user_id, name)
  where archived_at is null;
-- Memory dedup: one active client per email per user.
create unique index uq_clients_user_email
  on public.invoicememory_clients (user_id, lower(email))
  where email is not null and archived_at is null;

-- invoicememory_invoices
create index idx_invoices_user_id     on public.invoicememory_invoices (user_id);
create index idx_invoices_client_id   on public.invoicememory_invoices (client_id);
create index idx_invoices_user_status on public.invoicememory_invoices (user_id, status);
create index idx_invoices_user_issue  on public.invoicememory_invoices (user_id, issue_date desc);
-- Overdue sweep only ever scans outstanding invoicememory_invoices.
create index idx_invoices_outstanding_due
  on public.invoicememory_invoices (due_date)
  where status in ('sent', 'viewed', 'overdue');
-- Powers "remember my line items" suggestions.
create index idx_invoices_line_items
  on public.invoicememory_invoices using gin (line_items jsonb_path_ops);

-- invoicememory_subscriptions (user_id indexed via subscriptions_one_per_user)
create index idx_subscriptions_stripe_customer
  on public.invoicememory_subscriptions (stripe_customer_id);
create index idx_subscriptions_billable
  on public.invoicememory_subscriptions (status, current_period_end)
  where status in ('active', 'trialing');

-- invoicememory_payments
create index idx_payments_user_id on public.invoicememory_payments (user_id);
create index idx_payments_open
  on public.invoicememory_payments (status)
  where status in ('pending', 'processing');


-- ============================================================================
-- 5. FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.1 is_admin() — SECURITY DEFINER so admin policies on `invoicememory_profiles` itself
--     don't recurse into their own RLS check.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.invoicememory_profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- 5.2 update_updated_at() — attached to every table
-- ----------------------------------------------------------------------------
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5.3 handle_new_user_invoicememory() — auto-provision profile + free plan at signup.
--     Idempotent: safe if auth retries the insert.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user_invoicememory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.invoicememory_profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  -- Every user starts on the free plan. This IS the default-plan seed.
  insert into public.invoicememory_subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5.4 handle_invoice_insert() — the "memory" at work:
--     * verifies the client belongs to the invoice owner (tenant integrity)
--     * snapshots client_name
--     * auto-numbers the invoice atomically (INV-0001, INV-0002, ...)
--     * stamps sent_at / paid_at when created directly in that state
--     SECURITY DEFINER: must bump invoicememory_profiles.invoice_seq, which normal users
--     cannot update (column grant above). Explicit user_id predicates keep
--     tenant isolation even though RLS is bypassed.
-- ----------------------------------------------------------------------------
create or replace function public.handle_invoice_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_name text;
  v_seq         integer;
begin
  if new.client_id is not null then
    select name into v_client_name
    from public.invoicememory_clients
    where id = new.client_id
      and user_id = new.user_id;

    if not found then
      raise exception 'Client % does not exist or belongs to another account', new.client_id;
    end if;

    if new.client_name is null or btrim(new.client_name) = '' then
      new.client_name := v_client_name;
    end if;
  end if;

  if new.invoice_number is null or btrim(new.invoice_number) = '' then
    -- Row-level lock on the profile row makes this race-safe.
    update public.invoicememory_profiles
       set invoice_seq = invoice_seq + 1
     where id = new.user_id
    returning invoice_seq into v_seq;

    if v_seq is null then
      raise exception 'No profile found for user %', new.user_id;
    end if;

    new.invoice_number := 'INV-' || lpad(v_seq::text, 4, '0');
  end if;

  if new.status = 'sent' and new.sent_at is null then
    new.sent_at := now();
  end if;
  if new.status = 'paid' and new.paid_at is null then
    new.paid_at := now();
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5.5 handle_invoice_update() — guards + lifecycle timestamps on transitions.
-- ----------------------------------------------------------------------------
create or replace function public.handle_invoice_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'invoicememory_invoices.user_id is immutable';
  end if;

  if new.client_id is not null and new.client_id is distinct from old.client_id then
    perform 1
    from public.invoicememory_clients
    where id = new.client_id
      and user_id = new.user_id;

    if not found then
      raise exception 'Client % does not exist or belongs to another account', new.client_id;
    end if;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'sent' and new.sent_at is null then
      new.sent_at := now();
    end if;
    if new.status = 'paid' and new.paid_at is null then
      new.paid_at := now();
    end if;
  end if;

  return new;
end;
$$;


-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

-- Signup provisioning
create trigger on_auth_user_created_invoicememory
  after insert on auth.users
  for each row execute function public.handle_new_user_invoicememory();

-- Invoice domain logic
create trigger trg_invoices_before_insert
  before insert on public.invoicememory_invoices
  for each row execute function public.handle_invoice_insert();

create trigger trg_invoices_before_update
  before update on public.invoicememory_invoices
  for each row execute function public.handle_invoice_update();

-- updated_at on every table
create trigger trg_profiles_updated_at
  before update on public.invoicememory_profiles
  for each row execute function public.update_updated_at();

create trigger trg_clients_updated_at
  before update on public.invoicememory_clients
  for each row execute function public.update_updated_at();

create trigger trg_invoices_updated_at
  before update on public.invoicememory_invoices
  for each row execute function public.update_updated_at();

create trigger trg_subscriptions_updated_at
  before update on public.invoicememory_subscriptions
  for each row execute function public.update_updated_at();

create trigger trg_payments_updated_at
  before update on public.invoicememory_payments
  for each row execute function public.update_updated_at();


-- ============================================================================
-- 7. ROW-LEVEL SECURITY — enabled on EVERY table.
--    service_role bypasses RLS by default; no policies needed for it.
-- ============================================================================

alter table public.invoicememory_profiles      enable row level security;
alter table public.invoicememory_clients       enable row level security;
alter table public.invoicememory_invoices      enable row level security;
alter table public.invoicememory_subscriptions enable row level security;
alter table public.invoicememory_payments      enable row level security;

-- ----------------------------------------------------------------------------
-- invoicememory_profiles: read/update own row; admins read all.
-- No INSERT/DELETE policies — rows are managed by handle_new_user_invoicememory() + auth cascade.
-- ----------------------------------------------------------------------------
create policy "profiles_select_own"
  on public.invoicememory_profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.invoicememory_profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_select_all"
  on public.invoicememory_profiles for select
  to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- invoicememory_clients: full CRUD on own rows.
-- ----------------------------------------------------------------------------
create policy "clients_select_own"
  on public.invoicememory_clients for select
  to authenticated
  using (user_id = auth.uid());

create policy "clients_insert_own"
  on public.invoicememory_clients for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "clients_update_own"
  on public.invoicememory_clients for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "clients_delete_own"
  on public.invoicememory_clients for delete
  to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- invoicememory_invoices: read/create/update own. DELETE only for drafts — issued invoicememory_invoices
-- are financial records and must be voided, never erased.
-- ----------------------------------------------------------------------------
create policy "invoices_select_own"
  on public.invoicememory_invoices for select
  to authenticated
  using (user_id = auth.uid());

create policy "invoices_insert_own"
  on public.invoicememory_invoices for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "invoices_update_own"
  on public.invoicememory_invoices for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "invoices_delete_own_drafts"
  on public.invoicememory_invoices for delete
  to authenticated
  using (user_id = auth.uid() and status = 'draft');

-- ----------------------------------------------------------------------------
-- invoicememory_subscriptions: users read own; admins read all; ALL writes via service_role.
-- ----------------------------------------------------------------------------
create policy "subscriptions_select_own"
  on public.invoicememory_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

create policy "subscriptions_admin_select_all"
  on public.invoicememory_subscriptions for select
  to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- invoicememory_payments: users read own; admins read all; ALL writes via service_role.
-- ----------------------------------------------------------------------------
create policy "payments_select_own"
  on public.invoicememory_payments for select
  to authenticated
  using (user_id = auth.uid());

create policy "payments_admin_select_all"
  on public.invoicememory_payments for select
  to authenticated
  using (public.is_admin());


-- ============================================================================
-- 8. SEED DATA
-- ============================================================================
-- No lookup tables exist in v1 (delete-first): plans and statuses are enums,
-- so there are no static reference rows to INSERT in a fresh project.
-- The default "free" plan is seeded PER USER by handle_new_user_invoicememory(), which
-- inserts `invoicememory_subscriptions (plan='free', status='active')` at signup — every
-- account starts free with zero application code.
--
-- Reference shapes for future engineers (all user tables are auth-scoped, so
-- live rows can only exist after a real signup):
--
-- insert into public.invoicememory_clients (user_id, name, email, company)
-- values (auth.uid(), 'Acme Corp', 'billing@acme.com', 'Acme Corporation');
--
-- insert into public.invoicememory_invoices (user_id, client_id, line_items, subtotal_cents, tax_cents)
-- values (
--   auth.uid(),
--   '<client-uuid>',
--   '[{"description": "Design retainer — March", "quantity": 1, "unit_price_cents": 250000}]'::jsonb,
--   250000,
--   0
-- );  -- invoice_number, client_name, due_date all auto-filled by triggers.

select 'InvoiceMemory schema installed: 5 tables, RLS enforced, free plan auto-provisioned.' as status;

-- Self-validation patches
-- ============================================================================
-- InvoiceMemory — Self-Validation Patch (idempotent, safe to run after v1)
-- ============================================================================

-- Dashboard 'Paid this month' query filters user_id + status='paid' + paid_at
-- range. Give it a dedicated partial index instead of riding the generic
-- (user_id, status) index and filtering paid_at row-by-row.
create index if not exists idx_invoices_user_paid_at
  on public.invoicememory_invoices (user_id, paid_at desc)
  where status = 'paid';

-- The free-plan monthly cap counts invoicememory_invoices created this calendar month.
create index if not exists idx_invoices_user_created
  on public.invoicememory_invoices (user_id, created_at desc);

select 'InvoiceMemory validation patch applied.' as status;


-- Self-validation patches
-- ============================================================================
-- Self-validation result: NO schema changes required.
-- Verified: RLS enabled + policies on all 5 tables; column-level grants on
-- invoicememory_profiles (role/email/invoice_seq untouchable); every FK indexed (user_id x4,
-- client_id, stripe ids); partial indexes for autocomplete, overdue sweep,
-- monthly free-plan cap (user_id, created_at) and dashboard paid-this-month
-- (user_id, paid_at) already present from the v1 validation patch.
-- ============================================================================
select 'InvoiceMemory schema re-validated: no changes needed.' as status;


-- Self-validation patches
-- ============================================================================
-- InvoiceMemory — Self-Validation Patch 3 (idempotent, safe to re-run)
-- ============================================================================
-- 1. Harden update_updated_at() with a pinned search_path (Supabase linter:
--    function_search_path_mutable). Behavior unchanged; existing triggers
--    pick up the replaced function automatically.
create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 2. Re-verified, NO changes required:
--    * RLS enabled + policies on all 5 tables (invoicememory_profiles/invoicememory_clients/invoicememory_invoices/
--      invoicememory_subscriptions/invoicememory_payments); anon has no policies anywhere -> denied.
--    * Billing tables: INSERT/UPDATE/DELETE revoked from anon+authenticated;
--      service_role webhook is the single writer, by design.
--    * invoicememory_profiles column grants still block role / email / invoice_seq.
--    * Every FK indexed (user_id x4, client_id, stripe ids) plus partial
--      indexes for autocomplete, overdue sweep, monthly cap, paid-this-month.
select 'InvoiceMemory schema validation patch 3 applied.' as status;


-- Self-validation patches
-- ============================================================================
-- Self-validation pass 4: NO schema changes required.
-- Re-verified: RLS enabled + policies on all 5 tables; anon has zero policies
-- anywhere (denied by default); billing tables writable only by service_role;
-- profiles column grants still protect role / email / invoice_seq; every FK
-- indexed (user_id x4, client_id, stripe ids); partial indexes cover active-
-- client autocomplete, overdue sweep, monthly free-plan cap (user_id,
-- created_at), and dashboard paid-this-month (user_id, paid_at).
-- All patches in this pass are FILE-COLLISION re-asserts + metadata honesty.
-- ============================================================================
select 'InvoiceMemory schema re-validated (pass 4): no changes needed.' as status;

-- Self-validation patches
-- ============================================================================
-- Self-validation pass 5: NO schema changes required.
-- Re-verified: RLS enabled + policies on all 5 tables (profiles/clients/
-- invoices/subscriptions/payments); anon has zero policies anywhere (denied
-- by default); billing tables writable ONLY by service_role via webhooks;
-- profiles column grants still protect role / email / invoice_seq; every FK
-- indexed (user_id x4, client_id, stripe ids); partial indexes cover active-
-- client autocomplete, overdue sweep, monthly free-plan cap (user_id,
-- created_at), and dashboard paid-this-month (user_id, paid_at); invoice
-- numbering trigger remains race-safe via the profile row lock.
-- ALL pass-5 patches are application-layer FILE-COLLISION re-asserts
-- (supabase server/browser clients, billing portal response shape, dashboard
-- page, env + setup docs) — zero database work.
-- ============================================================================
select 'InvoiceMemory schema re-validated (pass 5): no changes needed.' as status;