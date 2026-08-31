-- Yums becomes Credits (Pato, 2026-08-31). TheFork ships a loyalty currency
-- called Yums with a "Yums accepted" restaurant badge — the same mechanic,
-- the same word, the same industry — so the guest noun moves off it.
--
-- Credits is not a new coinage: it is what 🪙 Credits §A already called the
-- internal accounting unit (1 Credit = 1 peso of menu price) and what the
-- landing page already says in public (CapitalCredits, "pay in Credits").
-- The rename collapses the old two-word split (guest "Yums" / internal
-- "Credit") into the one word both surfaces were already using.
--
-- RENAMES ONLY, no data to migrate: places.yums_enabled is the all-false
-- skeleton from 2026-08-29 and visits_config.payYums is a staged rail switch
-- no engine reads. Guarded so a replayed ledger (pgTAP CI) is a no-op the
-- second time through.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'places'
      and column_name = 'yums_enabled'
  ) then
    alter table public.places rename column yums_enabled to credits_enabled;
  end if;
end $$;

comment on column public.places.credits_enabled is
  'Settlement acceptance INTENT BIT: cleared to accept Mesita Credits when Credits land. The Credits engine ANDs this with visits_config.payCredits; Credits settle as a bill REDUCTION never a payment method, applying only to (subtotal - discount), never the tip. Unwritable at the place-doc door until the Credits PR adds its writer. All false since 2026-08-29 (skeleton).';

-- visits_config is a jsonb blob: move the key, preserve whatever value the
-- operator had (false everywhere today, but the console can write it).
update public.app_config
set visits_config = (visits_config - 'payYums')
  || jsonb_build_object('payCredits', coalesce(visits_config -> 'payYums', 'false'::jsonb))
where id = 1
  and visits_config ? 'payYums';

-- Post-flight: the rename must be complete on both surfaces, or this apply
-- aborts before the EFs start reading the new names.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'places'
      and column_name = 'credits_enabled'
      and data_type = 'boolean' and is_nullable = 'NO'
  ) then
    raise exception 'places.credits_enabled missing or wrong shape after rename';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'places'
      and column_name = 'yums_enabled'
  ) then
    raise exception 'places.yums_enabled survived the rename';
  end if;
  if exists (
    select 1 from public.app_config
    where id = 1 and visits_config ? 'payYums'
  ) then
    raise exception 'visits_config.payYums survived the rename';
  end if;
end $$;

notify pgrst, 'reload schema';
