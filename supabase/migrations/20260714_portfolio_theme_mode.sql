-- Theme portfolio mode: mode + themes columns; allow theme_* profile keys.

alter table public.portfolios
  add column if not exists mode text not null default 'beginner';

alter table public.portfolios
  add column if not exists themes jsonb not null default '[]'::jsonb;

-- Drop old profile check if present, then allow beginner profiles + theme slugs.
alter table public.portfolios drop constraint if exists portfolios_profile_check;

alter table public.portfolios
  add constraint portfolios_profile_check
  check (
    profile in ('conservative', 'balanced', 'aggressive')
    or profile ~ '^theme_[a-z0-9_]+$'
  );

alter table public.portfolios drop constraint if exists portfolios_mode_check;

alter table public.portfolios
  add constraint portfolios_mode_check
  check (mode in ('beginner', 'theme'));
