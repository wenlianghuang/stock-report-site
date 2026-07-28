-- Run in Supabase Dashboard → SQL Editor (existing projects)
-- Dual-leg holdings: cash + margin shares/costs

alter table public.holdings
  add column if not exists cash_share_count integer,
  add column if not exists cash_avg_cost numeric,
  add column if not exists margin_share_count integer,
  add column if not exists margin_avg_cost numeric;

alter table public.reports
  add column if not exists cash_share_count integer,
  add column if not exists cash_avg_cost numeric,
  add column if not exists margin_share_count integer,
  add column if not exists margin_avg_cost numeric;

-- Backfill from legacy single-leg rows
update public.holdings
set
  cash_share_count = case when coalesce(uses_margin, false) then null else share_count end,
  cash_avg_cost = case when coalesce(uses_margin, false) then null else avg_cost end,
  margin_share_count = case when coalesce(uses_margin, false) then share_count else null end,
  margin_avg_cost = case when coalesce(uses_margin, false) then avg_cost else null end
where cash_share_count is null
  and margin_share_count is null
  and share_count is not null;

update public.reports
set
  cash_share_count = case when coalesce(uses_margin, false) then null else share_count end,
  cash_avg_cost = case when coalesce(uses_margin, false) then null else avg_cost end,
  margin_share_count = case when coalesce(uses_margin, false) then share_count else null end,
  margin_avg_cost = case when coalesce(uses_margin, false) then avg_cost else null end
where is_holding
  and cash_share_count is null
  and margin_share_count is null
  and share_count is not null;
