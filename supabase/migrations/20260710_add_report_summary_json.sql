-- Structured visual summary for website UI (signal matrix, news, scenarios). Not in markdown/PDF.

alter table public.reports
  add column if not exists summary_json jsonb;

comment on column public.reports.summary_json is
  'Structured visual summary from stock-winning-rate (.summary.json)';
