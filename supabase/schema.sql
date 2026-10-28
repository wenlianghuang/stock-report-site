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
  uses_margin boolean not null default false,
  cash_share_count integer,
  cash_avg_cost numeric,
  margin_share_count integer,
  margin_avg_cost numeric,
  position_markdown text,
  facts_json jsonb,
  history_json jsonb,
  summary_json jsonb,
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
  uses_margin boolean not null default false,
  cash_share_count integer,
  cash_avg_cost numeric,
  margin_share_count integer,
  margin_avg_cost numeric,
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

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_job_id text not null,
  status text not null default 'queued'
    check (status in ('queued', 'gating', 'done', 'failed')),
  mode text not null default 'beginner'
    check (mode in ('beginner', 'theme')),
  profile text not null
    check (
      profile in ('conservative', 'balanced', 'aggressive')
      or profile ~ '^theme_[a-z0-9_]+$'
    ),
  themes jsonb not null default '[]'::jsonb,
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

-- Market weekly reports (see migrations/20260802_create_market_weeklies_table.sql)
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

-- Paper ledger for one logged-in user. Does not reference public.holdings.
-- Opening cash is 1,000,000 TWD (100000000 cents), matching OPENING_CASH_CENTS
-- and the idempotency keys in lib/paper-ledger.ts.
-- Settled cash changes only when a paper_cash_entries row is inserted.
-- One settlement row and one settlement ledger row per order, so posting twice
-- cannot deduct cash twice.

create table if not exists public.paper_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  cash_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paper_accounts_id_user_unique unique (id, user_id),
  constraint paper_accounts_cash_check check (cash_cents >= 0)
);

create table if not exists public.paper_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  stock_id text not null,
  market text not null,
  side text not null,
  order_type text not null,
  limit_price_cents bigint,
  lots integer not null,
  shares integer not null,
  session_date text not null,
  status text not null,
  reserved_cash_cents bigint not null,
  reserved_shares integer not null,
  limit_up_cents bigint not null,
  limit_down_cents bigint not null,
  reject_reason text,
  expire_reason text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paper_orders_id_user_unique unique (id, user_id),
  constraint paper_orders_account_user_fk
    foreign key (account_id, user_id)
    references public.paper_accounts (id, user_id)
    on delete cascade,
  constraint paper_orders_stock_id_check
    check (stock_id ~ '^[0-9]{4,6}$'),
  constraint paper_orders_market_check
    check (market in ('twse', 'tpex')),
  constraint paper_orders_side_check
    check (side in ('buy', 'sell')),
  constraint paper_orders_type_check
    check (order_type in ('market', 'limit')),
  constraint paper_orders_status_check
    check (status in ('working', 'filled', 'expired', 'cancelled', 'rejected')),
  constraint paper_orders_session_date_check
    check (session_date ~ '^\d{4}-\d{2}-\d{2}$'),
  constraint paper_orders_lots_check
    check (shares >= 1 and lots = shares / 1000),
  constraint paper_orders_limit_price_check
    check (
      (order_type = 'market' and limit_price_cents is null)
      or (order_type = 'limit' and limit_price_cents > 0)
    ),
  constraint paper_orders_band_check
    check (limit_down_cents > 0 and limit_up_cents >= limit_down_cents),
  constraint paper_orders_reserve_check
    check (
      reserved_cash_cents >= 0
      and reserved_shares >= 0
      and (
        (
          side = 'buy'
          and reserved_shares = 0
          and (
            (status = 'rejected' and reserved_cash_cents = 0)
            or (status <> 'rejected' and reserved_cash_cents > 0)
          )
        )
        or (
          side = 'sell'
          and reserved_cash_cents = 0
          and (
            (status = 'rejected' and reserved_shares = 0)
            or (status <> 'rejected' and reserved_shares = shares)
          )
        )
      )
    ),
  constraint paper_orders_reason_check
    check (
      (status <> 'rejected' or reject_reason is not null)
      and (status = 'rejected' or reject_reason is null)
      and (status <> 'expired' or expire_reason is not null)
      and (status = 'expired' or expire_reason is null)
    )
);

create index if not exists paper_orders_user_status_session_idx
  on public.paper_orders (user_id, status, session_date);

create table if not exists public.paper_fills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  order_id uuid not null,
  stock_id text not null,
  side text not null,
  fill_price_cents bigint not null,
  shares integer not null,
  notional_cents bigint not null,
  fee_cents bigint not null,
  tax_cents bigint not null,
  session_date text not null,
  created_at timestamptz not null default now(),
  constraint paper_fills_id_user_unique unique (id, user_id),
  constraint paper_fills_order_unique unique (order_id),
  constraint paper_fills_account_user_fk
    foreign key (account_id, user_id)
    references public.paper_accounts (id, user_id)
    on delete cascade,
  constraint paper_fills_order_user_fk
    foreign key (order_id, user_id)
    references public.paper_orders (id, user_id)
    on delete cascade,
  constraint paper_fills_stock_id_check
    check (stock_id ~ '^[0-9]{4,6}$'),
  constraint paper_fills_side_check
    check (side in ('buy', 'sell')),
  constraint paper_fills_price_check
    check (fill_price_cents > 0),
  constraint paper_fills_shares_check
    check (shares >= 1),
  constraint paper_fills_notional_check
    check (notional_cents = fill_price_cents * shares),
  constraint paper_fills_fee_check
    check (fee_cents >= 2000),
  constraint paper_fills_tax_check
    check (
      (side = 'buy' and tax_cents = 0)
      or (side = 'sell' and tax_cents >= 0)
    ),
  constraint paper_fills_session_date_check
    check (session_date ~ '^\d{4}-\d{2}-\d{2}$')
);

create table if not exists public.paper_settlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  order_id uuid not null,
  fill_id uuid not null,
  stock_id text not null,
  side text not null,
  settle_on text not null,
  status text not null default 'pending',
  shares integer not null,
  cash_cents bigint not null,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paper_settlements_id_user_unique unique (id, user_id),
  constraint paper_settlements_order_unique unique (order_id),
  constraint paper_settlements_fill_unique unique (fill_id),
  constraint paper_settlements_account_user_fk
    foreign key (account_id, user_id)
    references public.paper_accounts (id, user_id)
    on delete cascade,
  constraint paper_settlements_order_user_fk
    foreign key (order_id, user_id)
    references public.paper_orders (id, user_id)
    on delete cascade,
  constraint paper_settlements_fill_user_fk
    foreign key (fill_id, user_id)
    references public.paper_fills (id, user_id)
    on delete cascade,
  constraint paper_settlements_stock_id_check
    check (stock_id ~ '^[0-9]{4,6}$'),
  constraint paper_settlements_side_check
    check (side in ('buy', 'sell')),
  constraint paper_settlements_status_check
    check (status in ('pending', 'settled')),
  constraint paper_settlements_settle_on_check
    check (settle_on ~ '^\d{4}-\d{2}-\d{2}$'),
  constraint paper_settlements_shares_check
    check (shares >= 1),
  constraint paper_settlements_cash_check
    check (cash_cents <> 0 and (side <> 'buy' or cash_cents < 0)),
  constraint paper_settlements_settled_at_check
    check (
      (status = 'pending' and settled_at is null)
      or (status = 'settled' and settled_at is not null)
    )
);

create index if not exists paper_settlements_user_status_date_idx
  on public.paper_settlements (user_id, status, settle_on);

create table if not exists public.paper_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  stock_id text not null,
  settled_shares integer not null,
  avg_cost_cents bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paper_positions_user_stock_unique unique (user_id, stock_id),
  constraint paper_positions_account_user_fk
    foreign key (account_id, user_id)
    references public.paper_accounts (id, user_id)
    on delete cascade,
  constraint paper_positions_stock_id_check
    check (stock_id ~ '^[0-9]{4,6}$'),
  constraint paper_positions_shares_check
    check (settled_shares >= 0),
  constraint paper_positions_avg_check
    check (
      (settled_shares = 0 and avg_cost_cents is null)
      or (settled_shares > 0 and avg_cost_cents > 0)
    )
);

create table if not exists public.paper_cash_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  order_id uuid,
  settlement_id uuid,
  idempotency_key text not null,
  kind text not null,
  amount_cents bigint not null,
  created_at timestamptz not null default now(),
  constraint paper_cash_entries_key_unique unique (idempotency_key),
  constraint paper_cash_entries_account_user_fk
    foreign key (account_id, user_id)
    references public.paper_accounts (id, user_id)
    on delete cascade,
  constraint paper_cash_entries_order_user_fk
    foreign key (order_id, user_id)
    references public.paper_orders (id, user_id)
    on delete cascade,
  constraint paper_cash_entries_settlement_user_fk
    foreign key (settlement_id, user_id)
    references public.paper_settlements (id, user_id)
    on delete cascade,
  constraint paper_cash_entries_kind_check
    check (
      (
        kind = 'opening'
        and order_id is null
        and settlement_id is null
        and amount_cents = 100000000
      )
      or (
        kind = 'settlement'
        and order_id is not null
        and settlement_id is not null
        and amount_cents <> 0
      )
    )
);

create unique index if not exists paper_cash_entries_one_opening_idx
  on public.paper_cash_entries (account_id)
  where kind = 'opening';

create unique index if not exists paper_cash_entries_one_settlement_idx
  on public.paper_cash_entries (order_id)
  where kind = 'settlement';

create index if not exists paper_cash_entries_account_created_idx
  on public.paper_cash_entries (account_id, created_at);

alter table public.paper_accounts enable row level security;
alter table public.paper_orders enable row level security;
alter table public.paper_fills enable row level security;
alter table public.paper_settlements enable row level security;
alter table public.paper_positions enable row level security;
alter table public.paper_cash_entries enable row level security;

drop policy if exists "Users read own paper_accounts" on public.paper_accounts;
create policy "Users read own paper_accounts"
  on public.paper_accounts for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own paper_accounts" on public.paper_accounts;
create policy "Users insert own paper_accounts"
  on public.paper_accounts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own paper_accounts" on public.paper_accounts;
create policy "Users update own paper_accounts"
  on public.paper_accounts for update
  using (auth.uid() = user_id);

drop policy if exists "Users read own paper_orders" on public.paper_orders;
create policy "Users read own paper_orders"
  on public.paper_orders for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own paper_orders" on public.paper_orders;
create policy "Users insert own paper_orders"
  on public.paper_orders for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own paper_orders" on public.paper_orders;
create policy "Users update own paper_orders"
  on public.paper_orders for update
  using (auth.uid() = user_id);

drop policy if exists "Users read own paper_fills" on public.paper_fills;
create policy "Users read own paper_fills"
  on public.paper_fills for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own paper_fills" on public.paper_fills;
create policy "Users insert own paper_fills"
  on public.paper_fills for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users read own paper_settlements" on public.paper_settlements;
create policy "Users read own paper_settlements"
  on public.paper_settlements for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own paper_settlements" on public.paper_settlements;
create policy "Users insert own paper_settlements"
  on public.paper_settlements for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own paper_settlements" on public.paper_settlements;
create policy "Users update own paper_settlements"
  on public.paper_settlements for update
  using (auth.uid() = user_id);

drop policy if exists "Users read own paper_positions" on public.paper_positions;
create policy "Users read own paper_positions"
  on public.paper_positions for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own paper_positions" on public.paper_positions;
create policy "Users insert own paper_positions"
  on public.paper_positions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own paper_positions" on public.paper_positions;
create policy "Users update own paper_positions"
  on public.paper_positions for update
  using (auth.uid() = user_id);

drop policy if exists "Users read own paper_cash_entries" on public.paper_cash_entries;
create policy "Users read own paper_cash_entries"
  on public.paper_cash_entries for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own paper_cash_entries" on public.paper_cash_entries;
create policy "Users insert own paper_cash_entries"
  on public.paper_cash_entries for insert
  with check (auth.uid() = user_id);

create or replace function public.touch_paper_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.guard_paper_account_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.created_at is distinct from old.created_at
  then
    raise exception '不能改帳戶身份';
  end if;

  if new.cash_cents is distinct from old.cash_cents
    and current_setting('paper.cash_posting', true) is distinct from 'on'
  then
    raise exception '現金只能經由流水入帳';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.guard_paper_settlement_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.account_id is distinct from old.account_id
    or new.order_id is distinct from old.order_id
    or new.fill_id is distinct from old.fill_id
    or new.stock_id is distinct from old.stock_id
    or new.side is distinct from old.side
    or new.settle_on is distinct from old.settle_on
    or new.shares is distinct from old.shares
    or new.cash_cents is distinct from old.cash_cents
    or new.created_at is distinct from old.created_at
  then
    raise exception '交割內容不能修改';
  end if;

  if old.status = 'settled'
    and (
      new.status is distinct from old.status
      or new.settled_at is distinct from old.settled_at
    )
  then
    raise exception '已交割不能改回';
  end if;

  if (
    new.status is distinct from old.status
    or new.settled_at is distinct from old.settled_at
  )
    and current_setting('paper.cash_posting', true) is distinct from 'on'
  then
    raise exception '交割只能經由流水入帳';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.apply_paper_cash_entry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform set_config('paper.cash_posting', 'on', true);

  if new.kind = 'settlement' then
    update public.paper_settlements
    set status = 'settled',
        settled_at = now()
    where id = new.settlement_id
      and order_id = new.order_id
      and account_id = new.account_id
      and user_id = new.user_id
      and status = 'pending'
      and cash_cents = new.amount_cents;

    if not found then
      raise exception '找不到待交割紀錄';
    end if;
  end if;

  update public.paper_accounts
  set cash_cents = cash_cents + new.amount_cents
  where id = new.account_id
    and user_id = new.user_id;

  if not found then
    raise exception '模擬帳戶不存在';
  end if;

  return new;
end;
$$;

create or replace function public.open_paper_account()
returns public.paper_accounts
language plpgsql
security invoker
set search_path = public
as $$
declare
  acct public.paper_accounts;
begin
  if auth.uid() is null then
    raise exception '未登入';
  end if;

  insert into public.paper_accounts (user_id, cash_cents)
  values (auth.uid(), 0)
  returning * into acct;

  insert into public.paper_cash_entries (
    user_id,
    account_id,
    idempotency_key,
    kind,
    amount_cents
  ) values (
    auth.uid(),
    acct.id,
    acct.id::text || ':opening',
    'opening',
    100000000
  );

  select * into acct
  from public.paper_accounts
  where id = acct.id;

  return acct;
exception
  when unique_violation then
    raise exception '已經有模擬帳戶';
end;
$$;

drop trigger if exists paper_accounts_guard on public.paper_accounts;
create trigger paper_accounts_guard
  before update on public.paper_accounts
  for each row
  execute function public.guard_paper_account_update();

drop trigger if exists paper_orders_updated_at on public.paper_orders;
create trigger paper_orders_updated_at
  before update on public.paper_orders
  for each row
  execute function public.touch_paper_updated_at();

drop trigger if exists paper_settlements_guard on public.paper_settlements;
create trigger paper_settlements_guard
  before update on public.paper_settlements
  for each row
  execute function public.guard_paper_settlement_update();

drop trigger if exists paper_positions_updated_at on public.paper_positions;
create trigger paper_positions_updated_at
  before update on public.paper_positions
  for each row
  execute function public.touch_paper_updated_at();

drop trigger if exists paper_cash_entries_apply on public.paper_cash_entries;
create trigger paper_cash_entries_apply
  before insert on public.paper_cash_entries
  for each row
  execute function public.apply_paper_cash_entry();

revoke all on function public.touch_paper_updated_at() from public, anon, authenticated;
revoke all on function public.guard_paper_account_update() from public, anon, authenticated;
revoke all on function public.guard_paper_settlement_update() from public, anon, authenticated;
revoke all on function public.apply_paper_cash_entry() from public, anon, authenticated;
revoke all on function public.open_paper_account() from public, anon, authenticated;
grant execute on function public.open_paper_account() to authenticated;

-- Cost basis and realized P&L for paper settlement.
-- Cash still moves only through paper_cash_entries.
-- Does not reference public.holdings.

alter table public.paper_positions
  add column if not exists cost_basis_cents bigint;

alter table public.paper_positions
  drop constraint if exists paper_positions_avg_check;

alter table public.paper_positions
  add constraint paper_positions_avg_check
  check (
    (settled_shares = 0 and avg_cost_cents is null and cost_basis_cents is null)
    or (settled_shares > 0 and avg_cost_cents > 0 and cost_basis_cents > 0)
  );

alter table public.paper_settlements
  add column if not exists realized_pnl_cents bigint;

alter table public.paper_settlements
  drop constraint if exists paper_settlements_pnl_check;

alter table public.paper_settlements
  add constraint paper_settlements_pnl_check
  check (realized_pnl_cents is null or side = 'sell');

create or replace function public.guard_paper_settlement_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.account_id is distinct from old.account_id
    or new.order_id is distinct from old.order_id
    or new.fill_id is distinct from old.fill_id
    or new.stock_id is distinct from old.stock_id
    or new.side is distinct from old.side
    or new.settle_on is distinct from old.settle_on
    or new.shares is distinct from old.shares
    or new.cash_cents is distinct from old.cash_cents
    or new.created_at is distinct from old.created_at
  then
    raise exception '交割內容不能修改';
  end if;

  if new.realized_pnl_cents is distinct from old.realized_pnl_cents
    and (old.status <> 'pending' or old.realized_pnl_cents is not null)
  then
    raise exception '已實現損益不能修改';
  end if;

  if old.status = 'settled'
    and (
      new.status is distinct from old.status
      or new.settled_at is distinct from old.settled_at
    )
  then
    raise exception '已交割不能改回';
  end if;

  if (
    new.status is distinct from old.status
    or new.settled_at is distinct from old.settled_at
  )
    and current_setting('paper.cash_posting', true) is distinct from 'on'
  then
    raise exception '交割只能經由流水入帳';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.insert_paper_order(
  p_order_id uuid,
  p_stock_id text,
  p_market text,
  p_side text,
  p_order_type text,
  p_limit_price_cents bigint,
  p_lots integer,
  p_shares integer,
  p_session_date text,
  p_reserved_cash_cents bigint,
  p_reserved_shares integer,
  p_limit_up_cents bigint,
  p_limit_down_cents bigint
) returns public.paper_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  acct public.paper_accounts;
  available_cash bigint;
  settled integer;
  reserved_shares integer;
  pending_shares integer;
  created public.paper_orders;
begin
  if auth.uid() is null then
    raise exception '未登入';
  end if;

  select * into acct
  from public.paper_accounts
  where user_id = auth.uid()
  for update;

  if not found then
    raise exception '沒有模擬帳戶';
  end if;

  select coalesce(sum(reserved_cash_cents), 0)
  into available_cash
  from public.paper_orders
  where user_id = auth.uid()
    and status = 'working'
    and side = 'buy';

  available_cash := acct.cash_cents - available_cash - coalesce((
    select sum(-cash_cents)
    from public.paper_settlements
    where user_id = auth.uid()
      and status = 'pending'
      and side = 'buy'
  ), 0);

  if p_side = 'buy' and available_cash < p_reserved_cash_cents then
    raise exception '可用現金不足';
  end if;

  if p_side = 'sell' then
    select settled_shares into settled
    from public.paper_positions
    where user_id = auth.uid()
      and stock_id = p_stock_id
    for update;

    select coalesce(sum(o.reserved_shares), 0)
    into reserved_shares
    from public.paper_orders o
    where o.user_id = auth.uid()
      and o.status = 'working'
      and o.side = 'sell'
      and o.stock_id = p_stock_id;

    select coalesce(sum(s.shares), 0)
    into pending_shares
    from public.paper_settlements s
    where s.user_id = auth.uid()
      and s.status = 'pending'
      and s.side = 'sell'
      and s.stock_id = p_stock_id;

    if coalesce(settled, 0) - reserved_shares - pending_shares < p_shares then
      raise exception '已交割股數不足';
    end if;
  end if;

  insert into public.paper_orders (
    id,
    user_id,
    account_id,
    stock_id,
    market,
    side,
    order_type,
    limit_price_cents,
    lots,
    shares,
    session_date,
    status,
    reserved_cash_cents,
    reserved_shares,
    limit_up_cents,
    limit_down_cents
  ) values (
    p_order_id,
    auth.uid(),
    acct.id,
    p_stock_id,
    p_market,
    p_side,
    p_order_type,
    p_limit_price_cents,
    p_lots,
    p_shares,
    p_session_date,
    'working',
    p_reserved_cash_cents,
    p_reserved_shares,
    p_limit_up_cents,
    p_limit_down_cents
  )
  returning * into created;

  return created;
end;
$$;

create or replace function public.cancel_paper_order(p_order_id uuid)
returns public.paper_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  acct_id uuid;
  updated public.paper_orders;
begin
  if auth.uid() is null then
    raise exception '未登入';
  end if;

  select id into acct_id
  from public.paper_accounts
  where user_id = auth.uid()
  for update;

  update public.paper_orders
  set status = 'cancelled'
  where id = p_order_id
    and user_id = auth.uid()
    and status = 'working'
  returning * into updated;

  if not found then
    raise exception '只有掛著的單可以取消';
  end if;

  return updated;
end;
$$;

create or replace function public.apply_paper_close(
  p_expected_cash_cents bigint,
  p_operations jsonb
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  acct public.paper_accounts;
  op jsonb;
  ord public.paper_orders;
  settlement public.paper_settlements;
  pos public.paper_positions;
  old_shares integer := 0;
  old_basis bigint := 0;
  new_shares integer;
  new_basis bigint;
  new_avg bigint;
  removed bigint;
  realized bigint;
begin
  if auth.uid() is null then
    raise exception '未登入';
  end if;

  select * into acct
  from public.paper_accounts
  where user_id = auth.uid()
  for update;

  if not found then
    raise exception '沒有模擬帳戶';
  end if;

  if acct.cash_cents <> p_expected_cash_cents then
    raise exception '帳簿已更新';
  end if;

  for op in select value from jsonb_array_elements(p_operations)
  loop
    if op->>'op' = 'expire' then
      update public.paper_orders
      set status = 'expired',
          expire_reason = op->>'reason'
      where id = (op->>'order_id')::uuid
        and user_id = auth.uid()
        and status = 'working';

      if not found then
        perform 1
        from public.paper_orders
        where id = (op->>'order_id')::uuid
          and user_id = auth.uid()
          and status = 'expired';
        if not found then
          raise exception '委託無法到期';
        end if;
      end if;

    elsif op->>'op' = 'fill' then
      select * into ord
      from public.paper_orders
      where id = (op->>'order_id')::uuid
        and user_id = auth.uid()
      for update;

      if not found then
        raise exception '找不到委託';
      end if;

      if ord.status = 'working' then
        if ord.shares <> (op->>'shares')::integer then
          raise exception '成交股數不一致';
        end if;
        if (op->>'fill_price_cents')::bigint * ord.shares <> (op->>'notional_cents')::bigint then
          raise exception '成交金額不一致';
        end if;

        insert into public.paper_fills (
          id,
          user_id,
          account_id,
          order_id,
          stock_id,
          side,
          fill_price_cents,
          shares,
          notional_cents,
          fee_cents,
          tax_cents,
          session_date
        ) values (
          (op->>'fill_id')::uuid,
          auth.uid(),
          ord.account_id,
          ord.id,
          ord.stock_id,
          ord.side,
          (op->>'fill_price_cents')::bigint,
          ord.shares,
          (op->>'notional_cents')::bigint,
          (op->>'fee_cents')::bigint,
          (op->>'tax_cents')::bigint,
          ord.session_date
        );

        insert into public.paper_settlements (
          id,
          user_id,
          account_id,
          order_id,
          fill_id,
          stock_id,
          side,
          settle_on,
          status,
          shares,
          cash_cents
        ) values (
          (op->>'settlement_id')::uuid,
          auth.uid(),
          ord.account_id,
          ord.id,
          (op->>'fill_id')::uuid,
          ord.stock_id,
          ord.side,
          op->>'settle_on',
          'pending',
          ord.shares,
          (op->>'cash_cents')::bigint
        );

        update public.paper_orders
        set status = 'filled'
        where id = ord.id;
      elsif ord.status <> 'filled' then
        raise exception '委託無法成交';
      end if;

    elsif op->>'op' = 'settle' then
      select * into settlement
      from public.paper_settlements
      where id = (op->>'settlement_id')::uuid
        and user_id = auth.uid()
      for update;

      if not found then
        raise exception '找不到待交割紀錄';
      end if;

      if settlement.status = 'pending' then
        select * into pos
        from public.paper_positions
        where user_id = auth.uid()
          and stock_id = settlement.stock_id
        for update;

        if found then
          old_shares := pos.settled_shares;
          old_basis := coalesce(pos.cost_basis_cents, 0);
        else
          old_shares := 0;
          old_basis := 0;
        end if;

        if settlement.side = 'buy' then
          new_shares := old_shares + settlement.shares;
          new_basis := old_basis + (-settlement.cash_cents);
          realized := null;
        else
          if old_shares < settlement.shares then
            raise exception '已交割股數不足';
          end if;
          if settlement.shares = old_shares then
            removed := old_basis;
          else
            removed := (old_basis * settlement.shares) / old_shares;
          end if;
          new_shares := old_shares - settlement.shares;
          new_basis := old_basis - removed;
          realized := settlement.cash_cents - removed;
        end if;

        if new_shares = 0 then
          new_avg := null;
        else
          new_avg := (new_basis + (new_shares / 2)) / new_shares;
        end if;

        if (op->>'settled_shares')::integer is distinct from new_shares
          or (op->>'avg_cost_cents')::bigint is distinct from new_avg
          or (op->>'cost_basis_cents')::bigint is distinct from (
            case when new_shares = 0 then null else new_basis end
          )
        then
          raise exception '部位成本不一致';
        end if;

        if settlement.side = 'sell' then
          if (op->>'realized_pnl_cents')::bigint is distinct from realized then
            raise exception '已實現損益不一致';
          end if;
        elsif op->>'realized_pnl_cents' is not null then
          raise exception '買進沒有已實現損益';
        end if;

        if new_shares = 0 then
          delete from public.paper_positions
          where user_id = auth.uid()
            and stock_id = settlement.stock_id;
        else
          insert into public.paper_positions (
            user_id,
            account_id,
            stock_id,
            settled_shares,
            avg_cost_cents,
            cost_basis_cents
          ) values (
            auth.uid(),
            settlement.account_id,
            settlement.stock_id,
            new_shares,
            new_avg,
            new_basis
          )
          on conflict (user_id, stock_id) do update
          set settled_shares = excluded.settled_shares,
              avg_cost_cents = excluded.avg_cost_cents,
              cost_basis_cents = excluded.cost_basis_cents,
              account_id = excluded.account_id;
        end if;

        if settlement.side = 'sell' then
          update public.paper_settlements
          set realized_pnl_cents = realized
          where id = settlement.id;
        end if;

        insert into public.paper_cash_entries (
          user_id,
          account_id,
          order_id,
          settlement_id,
          idempotency_key,
          kind,
          amount_cents
        ) values (
          auth.uid(),
          settlement.account_id,
          settlement.order_id,
          settlement.id,
          settlement.order_id::text || ':settlement',
          'settlement',
          settlement.cash_cents
        );
      end if;
    else
      raise exception '未知的結算動作';
    end if;
  end loop;

  select cash_cents into new_basis
  from public.paper_accounts
  where id = acct.id;

  return new_basis;
end;
$$;

revoke all on function public.guard_paper_settlement_update() from public, anon, authenticated;
revoke all on function public.insert_paper_order(uuid, text, text, text, text, bigint, integer, integer, text, bigint, integer, bigint, bigint) from public, anon, authenticated;
revoke all on function public.cancel_paper_order(uuid) from public, anon, authenticated;
revoke all on function public.apply_paper_close(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.insert_paper_order(uuid, text, text, text, text, bigint, integer, integer, text, bigint, integer, bigint, bigint) to authenticated;
grant execute on function public.cancel_paper_order(uuid) to authenticated;
grant execute on function public.apply_paper_close(bigint, jsonb) to authenticated;
