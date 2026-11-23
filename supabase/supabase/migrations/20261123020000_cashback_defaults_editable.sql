-- MESITA-4700 — THE CASHBACK DEFAULTS ARE EDITABLE (Pato, 2026-11-22: "Yes,
-- editable", on Admin › Offers › Cashbacks). The defaults every place without
-- its own saved lines reads move from code into one row an admin edits:
-- Welcome, Returning Regular, Returning VIP (Off · 5 · 10 · 15 · 20 %) and the
-- cap per bill. A place's own row in place_cashback_settings still wins.
--
-- 1. cashback_defaults: a singleton (id = true), seeded 10 / 5 / 10 %, MX$200.
--    It survives Admin Reset (config, not operational data).
-- 2. place_cashback_rates reads it; the literals stay as the last fallback, so
--    a missing row never stops a bill from earning.
-- Written only by admin-web-save-cashback-defaults.

create table if not exists public.cashback_defaults (
  id          boolean primary key default true check (id),
  welcome_bps integer not null default 1000 check (welcome_bps in (0, 500, 1000, 1500, 2000)),
  regular_bps integer not null default 500  check (regular_bps in (0, 500, 1000, 1500, 2000)),
  vip_bps     integer not null default 1000 check (vip_bps in (0, 500, 1000, 1500, 2000)),
  cap_cents   integer not null default 20000 check (cap_cents >= 0 and cap_cents <= 1000000),
  updated_at  timestamptz not null default now(),
  updated_by  text
);
alter table public.cashback_defaults enable row level security;
revoke all on table public.cashback_defaults from public, anon, authenticated;
grant all on table public.cashback_defaults to service_role;
comment on table public.cashback_defaults is
  'MESITA-4700: the cashback lines every place without its own place_cashback_settings row reads (basis points, Off/5/10/15/20 %) and the cap per bill in cents. One row (id = true). Edited from Admin › Offers (admin-web-save-cashback-defaults). Service role only.';

insert into public.cashback_defaults (id) values (true) on conflict (id) do nothing;

insert into public.admin_reset_preserve (table_name, reason) values
  ('cashback_defaults', 'MESITA-4700: the cashback defaults are configuration an admin sets, not operational data.')
on conflict (table_name) do nothing;

create or replace function public.place_cashback_rates(p_place_id uuid)
 returns table (welcome_bps integer, regular_bps integer, vip_bps integer, cap_cents integer)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select coalesce(s.welcome_bps, d.welcome_bps, 1000), coalesce(s.regular_bps, d.regular_bps, 500),
         coalesce(s.vip_bps, d.vip_bps, 1000), coalesce(s.cap_cents, d.cap_cents, 20000)
    from (select 1) one
    left join public.cashback_defaults d on d.id
    left join public.place_cashback_settings s on s.place_id = p_place_id;
$function$;
revoke all on function public.place_cashback_rates(uuid) from public, anon, authenticated;
grant execute on function public.place_cashback_rates(uuid) to service_role;
comment on function public.place_cashback_rates(uuid) is
  'MESITA-4698, MESITA-4700: the cashback lines that bind a place now: its own row, else cashback_defaults, else 10/5/10 %, MX$200. Internal.';
