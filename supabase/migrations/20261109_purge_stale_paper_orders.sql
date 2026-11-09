-- Drop unfilled orders from earlier calendar days.
-- Filled orders stay: a fill row blocks the delete.

create or replace function public.purge_stale_paper_orders(p_today text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  if auth.uid() is null then
    raise exception '未登入';
  end if;
  if p_today !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception '日期不正確';
  end if;

  delete from public.paper_orders as stale
  where stale.user_id = auth.uid()
    and stale.status in ('expired', 'cancelled', 'rejected')
    and stale.session_date < p_today
    and not exists (
      select 1
      from public.paper_fills as fill
      where fill.order_id = stale.id
        and fill.user_id = stale.user_id
    );

  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.purge_stale_paper_orders(text) from public, anon, authenticated;
grant execute on function public.purge_stale_paper_orders(text) to authenticated;
