-- Run in Supabase Dashboard → SQL Editor (existing projects)
-- Phase A: personal margin flag on holdings + report snapshot

alter table public.holdings
  add column if not exists uses_margin boolean not null default false;

alter table public.reports
  add column if not exists uses_margin boolean not null default false;
