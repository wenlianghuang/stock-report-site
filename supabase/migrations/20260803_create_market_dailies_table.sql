-- User market daily brief history. Agent artifacts remain under reports/market/{trade_date}/.

create table if not exists public.market_dailies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_job_id text not null,
  status text not null default 'queued'
    check (status in ('queued', 'gating', 'done', 'failed')),
  trade_date text,
  for_session text,
  error text,
  markdown text,
  facts_json jsonb,
  summary_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_dailies_user_id_created_at_idx
  on public.market_dailies (user_id, created_at desc);

create index if not exists market_dailies_user_id_trade_date_idx
  on public.market_dailies (user_id, trade_date);

alter table public.market_dailies enable row level security;

drop policy if exists "Users read own market_dailies" on public.market_dailies;
create policy "Users read own market_dailies"
  on public.market_dailies for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own market_dailies" on public.market_dailies;
create policy "Users insert own market_dailies"
  on public.market_dailies for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own market_dailies" on public.market_dailies;
create policy "Users update own market_dailies"
  on public.market_dailies for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own market_dailies" on public.market_dailies;
create policy "Users delete own market_dailies"
  on public.market_dailies for delete
  using (auth.uid() = user_id);

create or replace function public.set_market_dailies_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists market_dailies_updated_at on public.market_dailies;
create trigger market_dailies_updated_at
  before update on public.market_dailies
  for each row
  execute function public.set_market_dailies_updated_at();
