-- User portfolio recommendation history (website UI). Agent files remain under reports/portfolio/{date}/.

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_job_id text not null,
  status text not null default 'queued'
    check (status in ('queued', 'gating', 'done', 'failed')),
  profile text not null
    check (profile in ('conservative', 'balanced', 'aggressive')),
  amount integer not null
    check (amount >= 50000),
  trade_date text,
  error text,
  narrative text,
  facts_json jsonb,
  generated_via text
    check (generated_via is null or generated_via in ('agy', 'rules')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portfolios_user_id_created_at_idx
  on public.portfolios (user_id, created_at desc);

create index if not exists portfolios_user_id_trade_date_idx
  on public.portfolios (user_id, trade_date);

alter table public.portfolios enable row level security;

drop policy if exists "Users read own portfolios" on public.portfolios;
create policy "Users read own portfolios"
  on public.portfolios for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own portfolios" on public.portfolios;
create policy "Users insert own portfolios"
  on public.portfolios for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own portfolios" on public.portfolios;
create policy "Users update own portfolios"
  on public.portfolios for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own portfolios" on public.portfolios;
create policy "Users delete own portfolios"
  on public.portfolios for delete
  using (auth.uid() = user_id);

create or replace function public.set_portfolios_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portfolios_updated_at on public.portfolios;
create trigger portfolios_updated_at
  before update on public.portfolios
  for each row
  execute function public.set_portfolios_updated_at();
