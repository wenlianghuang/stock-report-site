-- User market weekly report history. Agent artifacts remain under reports/market/{week_end}/.

create table if not exists public.market_weeklies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_job_id text not null,
  status text not null default 'queued'
    check (status in ('queued', 'gating', 'done', 'failed')),
  week_start text,
  week_end text,
  error text,
  markdown text,
  facts_json jsonb,
  summary_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_weeklies_user_id_created_at_idx
  on public.market_weeklies (user_id, created_at desc);

create index if not exists market_weeklies_user_id_week_end_idx
  on public.market_weeklies (user_id, week_end);

alter table public.market_weeklies enable row level security;

drop policy if exists "Users read own market_weeklies" on public.market_weeklies;
create policy "Users read own market_weeklies"
  on public.market_weeklies for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own market_weeklies" on public.market_weeklies;
create policy "Users insert own market_weeklies"
  on public.market_weeklies for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own market_weeklies" on public.market_weeklies;
create policy "Users update own market_weeklies"
  on public.market_weeklies for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own market_weeklies" on public.market_weeklies;
create policy "Users delete own market_weeklies"
  on public.market_weeklies for delete
  using (auth.uid() = user_id);

create or replace function public.set_market_weeklies_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists market_weeklies_updated_at on public.market_weeklies;
create trigger market_weeklies_updated_at
  before update on public.market_weeklies
  for each row
  execute function public.set_market_weeklies_updated_at();
