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
