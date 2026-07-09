-- Run in Supabase Dashboard → SQL Editor

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

