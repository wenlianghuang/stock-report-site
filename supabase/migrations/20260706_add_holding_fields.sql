-- Run in Supabase Dashboard → SQL Editor (existing projects)

alter table public.reports drop constraint if exists reports_status_check;

alter table public.reports
  add column if not exists stock_name text,
  add column if not exists is_holding boolean not null default false,
  add column if not exists share_count integer,
  add column if not exists avg_cost numeric,
  add column if not exists position_markdown text;

alter table public.reports
  add constraint reports_status_check
    check (status in ('queued', 'fetching', 'gating', 'positioning', 'done', 'failed'));

alter table public.reports drop constraint if exists reports_holding_share_count_check;
alter table public.reports
  add constraint reports_holding_share_count_check
    check (not is_holding or (share_count is not null and share_count > 0));

alter table public.reports drop constraint if exists reports_holding_avg_cost_check;
alter table public.reports
  add constraint reports_holding_avg_cost_check
    check (not is_holding or (avg_cost is not null and avg_cost > 0));
