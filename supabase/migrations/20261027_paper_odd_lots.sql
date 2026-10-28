-- Allow odd-lot paper orders. One share is enough; a full lot is still 1000 shares.
-- Existing whole-lot rows already satisfy lots = shares / 1000.

alter table public.paper_orders drop constraint if exists paper_orders_lots_check;
alter table public.paper_orders
  add constraint paper_orders_lots_check
  check (shares >= 1 and lots = shares / 1000);

alter table public.paper_fills drop constraint if exists paper_fills_shares_check;
alter table public.paper_fills
  add constraint paper_fills_shares_check
  check (shares >= 1);

alter table public.paper_settlements drop constraint if exists paper_settlements_shares_check;
alter table public.paper_settlements
  add constraint paper_settlements_shares_check
  check (shares >= 1);

alter table public.paper_positions drop constraint if exists paper_positions_shares_check;
alter table public.paper_positions
  add constraint paper_positions_shares_check
  check (settled_shares >= 0);
