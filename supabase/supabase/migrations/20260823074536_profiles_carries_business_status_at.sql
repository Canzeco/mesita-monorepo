-- MESITA-1277 — public.profiles carries business_status_at, and both INSTEAD OF
-- bodies carry the Operating pair.
--
-- MESITA-1239 added places.business_status + places.business_status_at
-- (20260823071937) and never touched the view. Production nevertheless
-- projected business_status, so that one column reached the live view through
-- an unmirrored cloud-only create-or-replace that added half the pair. The
-- result was a live 42703: _shared/place-columns.ts names BOTH columns, so
-- every read of PLACE_PUBLIC_COLUMNS / PLACE_BUSINESS_COLUMNS failed at plan
-- time (consumer browse, place detail, swipe, consumer-mcp, business overview,
-- business-web-update-project, the two admin setters), and so did every place
-- creation — _shared/create-place.ts builds business_status_at into the row and
-- savePlaceData inserts it into public.profiles.
--
-- This migration is also the missing mirror: no repo migration had ever added
-- EITHER column to the view, so a from-scratch db push diverged from
-- production. After this file, repo and cloud agree on both.
--
-- Everything is patched from the LIVE pg_get_viewdef / pg_get_functiondef
-- (Development Rules §B) — never from a repo snapshot, which would silently
-- revert whatever landed between that snapshot and now.
--
-- INVARIANT (carried from the live definition): security_invoker = true.
-- CREATE OR REPLACE VIEW keeps the anon/authenticated SELECT and service_role
-- write grants and both INSTEAD OF triggers bound, so appending one column at
-- the end needs no DROP VIEW and no re-grant.

do $$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_viewdef('public.profiles'::regclass, true);

  if v_def like '%business_status_at%' then
    raise notice 'profiles already projects business_status_at — nothing to do';
  else
    if v_def not like '%p.business_status%' then
      raise exception
        'profiles does not project business_status; refusing to guess where the pair belongs';
    end if;

    -- business_status is the LAST column of the live select, immediately
    -- before the FROM. Appending its timestamp after it keeps CREATE OR
    -- REPLACE append-only, which is what preserves grants and triggers.
    v_new := replace(
      v_def,
      'p.business_status
   FROM projects u',
      'p.business_status,
    p.business_status_at
   FROM projects u'
    );

    if v_new = v_def then
      raise exception
        'could not append business_status_at: business_status is no longer the final projected column';
    end if;

    execute 'create or replace view public.profiles with (security_invoker = true) as '
      || rtrim(btrim(v_new), ';');
  end if;
end
$$;

-- The comment is not carried by CREATE OR REPLACE's column change, but restate
-- it so the invariant travels with the object rather than only with this file.
comment on view public.profiles is
  'SECURITY INVOKER join of projects ⋈ places. Public reads follow projects_select_public_visible; service-role EFs bypass RLS. INVARIANT: any create-or-replace MUST keep with (security_invoker = true).';

-- Both INSTEAD OF bodies name neither column, so the write path dropped the
-- Operating pair silently even once the view projected it. Patch the LIVE
-- bodies rather than restating them: restating from a stale snapshot is
-- exactly what caused the ~3-minute outage recorded in 20260823072013.
do $$
declare
  v_src text;
  v_new text;
begin
  -- ── profiles_insert: column list, then VALUES list ──
  v_src := pg_get_functiondef('public.profiles_insert'::regproc);

  if v_src like '%business_status%' then
    raise notice 'profiles_insert already writes business_status — nothing to do';
  else
    v_new := replace(
      v_src,
      'reservation_channel, reservation_target, order_channel, order_target
  ) values (',
      'reservation_channel, reservation_target, order_channel, order_target,
    business_status, business_status_at
  ) values ('
    );
    if v_new = v_src then
      raise exception 'profiles_insert: column-list anchor not found';
    end if;

    v_src := v_new;
    v_new := replace(
      v_src,
      'new.reservation_channel, new.reservation_target, new.order_channel, new.order_target
  ) returning id into v_id;',
      'new.reservation_channel, new.reservation_target, new.order_channel, new.order_target,
    new.business_status, new.business_status_at
  ) returning id into v_id;'
    );
    if v_new = v_src then
      raise exception 'profiles_insert: values-list anchor not found';
    end if;

    execute v_new;
  end if;

  -- ── profiles_update: assignment list ──
  v_src := pg_get_functiondef('public.profiles_update'::regproc);

  if v_src like '%business_status%' then
    raise notice 'profiles_update already writes business_status — nothing to do';
  else
    v_new := replace(
      v_src,
      '    order_target = new.order_target,
',
      '    order_target = new.order_target,
    business_status = new.business_status,
    business_status_at = new.business_status_at,
'
    );
    if v_new = v_src then
      raise exception 'profiles_update: order_target assignment anchor not found';
    end if;

    execute v_new;
  end if;
end
$$;

-- ── Post-state assertions. A silent half-apply here is the exact failure this
-- file exists to end, so every invariant is checked, not assumed. ──
do $$
declare
  v_opts text[];
  v_cols int;
begin
  select c.reloptions into v_opts
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'profiles';

  if v_opts is null or not ('security_invoker=true' = any (v_opts)) then
    raise exception 'profiles lost security_invoker=true';
  end if;

  select count(*) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles'
    and column_name in ('business_status', 'business_status_at');
  if v_cols <> 2 then
    raise exception 'profiles projects % of the 2 Operating columns', v_cols;
  end if;

  if (select count(*) from pg_trigger t
      where t.tgrelid = 'public.profiles'::regclass and not t.tgisinternal) <> 2 then
    raise exception 'profiles lost an INSTEAD OF trigger';
  end if;

  if pg_get_functiondef('public.profiles_insert'::regproc) not like '%new.business_status_at%'
     or pg_get_functiondef('public.profiles_update'::regproc) not like '%business_status_at = new.business_status_at%'
  then
    raise exception 'an INSTEAD OF body still drops the Operating pair';
  end if;

  if has_table_privilege('anon', 'public.profiles', 'select') is not true
     or has_table_privilege('authenticated', 'public.profiles', 'select') is not true
     or has_table_privilege('service_role', 'public.profiles', 'insert') is not true
  then
    raise exception 'profiles lost a grant';
  end if;
end
$$;

notify pgrst, 'reload schema';
