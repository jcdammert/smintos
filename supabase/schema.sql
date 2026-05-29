-- ===========================================================================
-- Smintos schema + Row Level Security
-- Run in the Supabase SQL editor. Requires the pgcrypto extension for gen_random_uuid().
-- ===========================================================================

create extension if not exists "pgcrypto";

-- --- users -----------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  ghl_location_id text,
  ghl_api_key text,
  business_name text,
  created_at timestamptz not null default now()
);

-- --- clients ---------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  ghl_contact_id text unique,
  name text not null,
  phone text,
  email text,
  address text,
  city text,
  state text,
  postal_code text,
  country text,
  created_at timestamptz not null default now()
);
create index if not exists clients_user_id_idx on public.clients (user_id);

-- --- estimates -------------------------------------------------------------
create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  ghl_invoice_id text,
  estimate_number text not null,
  line_items jsonb not null default '[]'::jsonb,
  total numeric not null default 0,
  status text not null default 'draft'
    check (status in ('draft','sent','approved','declined')),
  sent_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists estimates_user_id_idx on public.estimates (user_id);

-- --- invoices --------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  estimate_id uuid references public.estimates (id) on delete set null,
  ghl_invoice_id text,
  invoice_number text not null,
  line_items jsonb not null default '[]'::jsonb,
  total numeric not null default 0,
  status text not null default 'sent'
    check (status in ('sent','paid','overdue')),
  due_date timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invoices_user_id_idx on public.invoices (user_id);

-- --- appointments ----------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  ghl_event_id text unique,
  title text not null,
  notes text,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 60,
  assigned_to text,
  created_at timestamptz not null default now()
);
create index if not exists appointments_user_id_idx on public.appointments (user_id);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
-- NextAuth issues its own JWTs (not Supabase Auth), so auth.uid() is not the
-- app user id here. We therefore:
--   * keep RLS ENABLED on every table (deny-by-default),
--   * grant access only to the service role (used by the server),
--   * scope every query by user_id in application code (lib/data.ts, lib/actions.ts).
--
-- If you later switch to Supabase Auth, replace the policies below with
-- `using (auth.uid() = user_id)` style policies as noted.
-- ===========================================================================

alter table public.users        enable row level security;
alter table public.clients      enable row level security;
alter table public.estimates    enable row level security;
alter table public.invoices     enable row level security;
alter table public.appointments enable row level security;

-- Service role bypasses RLS automatically; these explicit policies make intent
-- clear and allow auth.uid()-based access if you migrate to Supabase Auth.
do $$
declare t text;
begin
  foreach t in array array['users','clients','estimates','invoices','appointments']
  loop
    execute format('drop policy if exists "owner_select" on public.%I;', t);
    execute format('drop policy if exists "owner_modify" on public.%I;', t);
  end loop;
end $$;

-- users: a row is "owned" by itself (id = auth.uid())
create policy "owner_select" on public.users
  for select using (auth.uid() = id);
create policy "owner_modify" on public.users
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- child tables: owned via user_id = auth.uid()
create policy "owner_select" on public.clients
  for select using (auth.uid() = user_id);
create policy "owner_modify" on public.clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_select" on public.estimates
  for select using (auth.uid() = user_id);
create policy "owner_modify" on public.estimates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_select" on public.invoices
  for select using (auth.uid() = user_id);
create policy "owner_modify" on public.invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_select" on public.appointments
  for select using (auth.uid() = user_id);
create policy "owner_modify" on public.appointments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
