-- Settlement acceptance intent bits (Pato gate 2026-08-29, MESITA · Mesita
-- Pay + Accepts Yums skeleton). Two per-place flags for the two STAGED
-- settlement rails of the Ticket Pay step (🧾 Checkout: "the card and Yums
-- panels are STAGED chrome"): the in-Mesita card rail (Mesita Pay, Stripe
-- gateway later) and Yums / Mesita Credits.
--
-- INTENT BITS, not capability caches: each future engine ANDs its bit with
-- the global visits_config rail switch (payCard / payYums — shipped, staged,
-- zero consumers today) and rail-specific capability. Nothing writes these
-- yet — the shared place-doc write door REJECTS both keys ("unknown place
-- field") until the gateway / Credits PRs legalize them for their own
-- writers, which must target `places` directly (the profiles_update trigger
-- enumerates its SET list and silently drops unknown columns).
--
-- DELIBERATELY NOT added to the profiles view: profiles is SELECT-granted to
-- anon/authenticated (consumer browse reads it under RLS), so a view column
-- is publicly enumerable. These are admin-only facts, read via the existing
-- places-direct side-reads in admin-web-search-places and
-- business-web-get-overview — the `enrichment` precedent, not the
-- orders_enabled one (that flag is consumer-facing by design).

alter table public.places
  add column if not exists mesita_pay_enabled boolean not null default false,
  add column if not exists yums_enabled boolean not null default false;

comment on column public.places.mesita_pay_enabled is
  'Settlement acceptance INTENT BIT: cleared to accept Mesita Pay (the in-Mesita card rail) when it goes live. The payment engine ANDs this with visits_config.payCard and Stripe-derived capability - never treat it as a cache of Stripe account state. Unwritable at the place-doc door until the gateway PR adds its writer (must write places directly, not profiles). All false since 2026-08-29 (skeleton).';

comment on column public.places.yums_enabled is
  'Settlement acceptance INTENT BIT: cleared to accept Yums (Mesita Credits) when Credits land. The Credits engine ANDs this with visits_config.payYums; Yums settles as a bill REDUCTION never a payment method, applying only to (subtotal - discount), never the tip. Unwritable at the place-doc door until the Credits PR adds its writer. All false since 2026-08-29 (skeleton).';

-- Post-flight: the columns must exist with the right shape, or this apply
-- aborts before anything else builds on it (place_requests.sql pattern).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'places'
      and column_name = 'mesita_pay_enabled'
      and data_type = 'boolean' and is_nullable = 'NO'
  ) then
    raise exception 'places.mesita_pay_enabled missing or wrong shape after apply';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'places'
      and column_name = 'yums_enabled'
      and data_type = 'boolean' and is_nullable = 'NO'
  ) then
    raise exception 'places.yums_enabled missing or wrong shape after apply';
  end if;
end $$;

notify pgrst, 'reload schema';
