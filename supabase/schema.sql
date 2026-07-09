-- Run in Supabase Dashboard → SQL Editor

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stock_id text not null,
  stock_name text,
  agent_job_id text not null,
  status text not null default 'queued'
    check (status in ('queued', 'fetching', 'gating', 'positioning', 'done', 'failed')),
  trade_date text,
  error text,
  markdown text,
  is_holding boolean not null default false,
  share_count integer,
  avg_cost numeric,
  position_markdown text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_holding_share_count_check
    check (not is_holding or (share_count is not null and share_count > 0)),
  constraint reports_holding_avg_cost_check
    check (not is_holding or (avg_cost is not null and avg_cost > 0))
);

create index if not exists reports_user_id_created_at_idx
  on public.reports (user_id, created_at desc);

alter table public.reports enable row level security;

drop policy if exists "Users read own reports" on public.reports;
create policy "Users read own reports"
  on public.reports for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own reports" on public.reports;
create policy "Users insert own reports"
  on public.reports for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own reports" on public.reports;
create policy "Users update own reports"
  on public.reports for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own reports" on public.reports;
create policy "Users delete own reports"
  on public.reports for delete
  using (auth.uid() = user_id);

create or replace function public.set_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reports_updated_at on public.reports;
create trigger reports_updated_at
  before update on public.reports
  for each row
  execute function public.set_reports_updated_at();

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stock_id text not null,
  share_count integer not null,
  avg_cost numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint holdings_stock_id_check
    check (stock_id ~ '^[0-9]{4,6}$'),
  constraint holdings_share_count_check
    check (share_count > 0),
  constraint holdings_avg_cost_check
    check (avg_cost > 0),
  constraint holdings_user_stock_unique unique (user_id, stock_id)
);

create index if not exists holdings_user_id_stock_id_idx
  on public.holdings (user_id, stock_id);

alter table public.holdings enable row level security;

drop policy if exists "Users read own holdings" on public.holdings;
create policy "Users read own holdings"
  on public.holdings for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own holdings" on public.holdings;
create policy "Users insert own holdings"
  on public.holdings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own holdings" on public.holdings;
create policy "Users update own holdings"
  on public.holdings for update
  using (auth.uid() = user_id);

create or replace function public.set_holdings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists holdings_updated_at on public.holdings;
create trigger holdings_updated_at
  before update on public.holdings
  for each row
  execute function public.set_holdings_updated_at();
