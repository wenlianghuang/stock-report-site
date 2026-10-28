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
    check (lots >= 1 and shares = lots * 1000),
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
    check (shares >= 1000 and shares % 1000 = 0),
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
    check (shares >= 1000 and shares % 1000 = 0),
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
    check (settled_shares >= 0 and settled_shares % 1000 = 0),
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
