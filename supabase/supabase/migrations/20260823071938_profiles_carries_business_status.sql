-- MESITA-1239 (replay repair) — public.profiles projects business_status.
--
-- 20260823071937 added places.business_status + places.business_status_at and
-- never touched the view. 20260823074536 then appends business_status_at, but
-- it REFUSES to guess placement unless the view already projects
-- business_status:
--
--   if v_def not like '%p.business_status%' then
--     raise exception 'profiles does not project business_status; ...';
--
-- On production that guard passes, because business_status reached the live
-- view through a cloud-only create-or-replace (20260823071049) whose file was
-- never mirrored into the repo. A from-scratch replay of main has no such step,
-- so 074536 RAISES and the migration run dies. Live prod is fine; every fresh
-- environment, branch database and `db push` from a clean tree is not.
--
-- This is the missing middle. Stamped 071938 so it replays after the columns
-- exist (071937) and before the guard runs (074536).
--
-- IDEMPOTENT BY DESIGN. On production the view already projects the column, so
-- this is a no-op notice. It is written to be safe to apply anywhere, in any
-- order relative to the cloud ledger it is absent from.
--
-- Patched from LIVE pg_get_viewdef (Development Rules §B), never from a repo
-- snapshot — a snapshot silently reverts whatever landed after it was taken,
-- which is exactly how the trigger bodies were broken earlier today.
--
-- INVARIANT: security_invoker = true. CREATE OR REPLACE VIEW preserves it along
-- with the anon/authenticated SELECT grants, the service_role write grants and
-- both INSTEAD OF triggers, so appending one column needs no DROP VIEW and no
-- re-grant. Dropping the view would require both, and a rebuild that omits
-- security_invoker reopens the anon-browse RLS leak MESITA-599 already fixed.

do $$
declare
  v_def text;
  v_new text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'places'
      and column_name = 'business_status'
  ) then
    raise exception
      'places.business_status does not exist; 20260823071937 must run first';
  end if;

  v_def := pg_get_viewdef('public.profiles'::regclass, true);

  if v_def like '%business_status%' then
    raise notice 'profiles already projects business_status — nothing to do';
    return;
  end if;

  -- Append as the final projected column. The view is a flat select over
  -- places p (aliased), so the last column before FROM is the safe seam.
  v_new := regexp_replace(
    v_def,
    '(\s+)FROM ',
    E',\\1    p.business_status\\1FROM ',
    ''
  );

  if v_new = v_def then
    raise exception
      'could not locate the FROM seam in public.profiles; refusing to guess';
  end if;

  execute 'create or replace view public.profiles with (security_invoker = true) as ' || v_new;
  raise notice 'profiles now projects business_status';
end $$;

-- Post-condition: the invariant this file must never break.
do $$
begin
  if not exists (
    select 1 from pg_class
    where relname = 'profiles' and relnamespace = 'public'::regnamespace
      and reloptions @> array['security_invoker=true']
  ) then
    raise exception 'public.profiles lost security_invoker=true — anon-browse RLS leak';
  end if;
end $$;
