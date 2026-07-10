-- Chart data for website UI (facts + price history). Not embedded in markdown/PDF.

alter table public.reports
  add column if not exists facts_json jsonb,
  add column if not exists history_json jsonb;

comment on column public.reports.facts_json is
  'Deterministic chip/MA facts from stock-winning-rate (.facts.json)';
comment on column public.reports.history_json is
  'Slim daily history for website charts (date, close, volume)';
