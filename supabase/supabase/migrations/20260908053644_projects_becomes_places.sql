-- MESITA-1590 — `projects` becomes `places`, and its six child tables become
-- `place_*`. Stage 4 of 4 (EF directory renames / MESITA-1605, the
-- enrichment wire key / MESITA-1606, and the Atlas vacate to `PlaceProfile*`
-- / MESITA-1604 already shipped — this is what they cleared the way for).
--
-- WHY NOW, WHY SAFE. MESITA-1593 moved the Atlas half off `Place*` onto
-- `PlaceProfile*` specifically so this rename has nowhere left to collide:
-- a dry run over supabase/functions post-1593 found zero module-level
-- duplicate declarations, versus 7 in _shared/place-doc.ts alone before it.
-- An earlier attempt at this exact migration (same session, hours earlier)
-- applied cleanly and was rolled back only because the CODE sweep hit that
-- now-resolved collision while `main` still pointed at the old schema — see
-- the MESITA-1590 decision: comment thread for the full postmortem. The
-- schema half was never the problem; it is reproduced here in spirit,
-- re-verified against the LIVE catalog rather than replayed from memory
-- (the issue's own written inventory had already drifted: the FK this
-- migration renames is `projects_project_fk`, not `projects_place_fk` as
-- the issue text claims, and three functions — `is_project_member`,
-- `mark_place_claim_reviewed`, `admin_reset_database` — spell `project` and
-- are not in the issue's "6 plpgsql bodies" count).
--
-- WHAT FOLLOWS THE RENAME AND WHAT DOES NOT. Views and RLS policies (here
-- and in `storage.objects`) store parsed OID/regproc references, so
-- `profiles`, the `place_profiles` visibility policy, and every
-- `is_project_member(...)` call in a storage policy re-point themselves.
-- PL/pgSQL and SQL function BODIES are plain TEXT (`pg_proc.prosrc`), so
-- they do not — rebuilt below, in this same transaction, changing only the
-- renamed identifiers and nothing else.
--
-- Constraint, index, trigger and policy renames are catalog-driven loops,
-- not a hardcoded list: MESITA-1593 shipped with a hardcoded constraint
-- list and had to switch to a loop when CI's from-scratch replay proved one
-- constraint existed under a name no migration ever gave it. A loop reads
-- whatever the live/replayed catalog actually carries, so it is self-healing
-- against that class of drift instead of a second victim of it.

-- ── 1 · the two enums (their `_`-prefixed array types follow automatically) ─
alter type public.project_state rename to place_state;
alter type public.project_fiscal_type rename to place_fiscal_type;

-- ── 2 · the seven tables ────────────────────────────────────────────────────
alter table public.projects rename to places;
alter table public.project_members rename to place_members;
alter table public.project_invites rename to place_invites;
alter table public.project_plans rename to place_plans;
alter table public.project_strikes rename to place_strikes;
alter table public.project_subscriptions rename to place_subscriptions;
alter table public.project_verifications rename to place_verifications;

-- ── 3 · constraints (renaming a constraint renames the index it owns) ──────
do $$
declare r record;
begin
  for r in
    select conname, conrelid::regclass::text as tbl,
           replace(conname, 'project', 'place') as newname
      from pg_constraint
     where conrelid = any (array[
             'public.places','public.place_members','public.place_invites',
             'public.place_plans','public.place_strikes',
             'public.place_subscriptions','public.place_verifications'
           ]::regclass[])
       and conname ~* 'project'
  loop
    execute format('alter table %s rename constraint %I to %I', r.tbl, r.conname, r.newname);
  end loop;
end $$;

-- ── 4 · the standalone indexes (constraint-owned ones already moved above) ─
do $$
declare r record;
begin
  for r in
    select indexname, replace(indexname, 'project', 'place') as newname
      from pg_indexes
     where schemaname = 'public'
       and tablename = any (array[
             'places','place_members','place_invites','place_plans',
             'place_strikes','place_subscriptions','place_verifications'
           ])
       and indexname ~* 'project'
  loop
    execute format('alter index if exists public.%I rename to %I', r.indexname, r.newname);
  end loop;
end $$;

-- ── 5 · triggers ─────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select tgname, tgrelid::regclass::text as tbl,
           replace(tgname, 'project', 'place') as newname
      from pg_trigger
     where not tgisinternal
       and tgrelid = any (array[
             'public.places','public.place_members','public.place_invites',
             'public.place_plans','public.place_strikes',
             'public.place_subscriptions','public.place_verifications'
           ]::regclass[])
       and tgname ~* 'project'
  loop
    execute format('alter trigger %I on %s rename to %I', r.tgname, r.tbl, r.newname);
  end loop;
end $$;

-- ── 6 · the policy (its qual reads `state`/`content_state` values, no table
--        name inside it — nothing to re-verify there; the rename just
--        follows the table, and `places_select_public_visible` is free
--        since MESITA-1593 moved the old holder to
--        `place_profiles_select_public_visible`) ──────────────────────────
do $$
declare r record;
begin
  for r in
    select policyname, tablename,
           replace(policyname, 'project', 'place') as newname
      from pg_policies
     where schemaname = 'public'
       and tablename = any (array[
             'places','place_members','place_invites','place_plans',
             'place_strikes','place_subscriptions','place_verifications'
           ])
       and policyname ~* 'project'
  loop
    execute format('alter policy %I on public.%I rename to %I', r.policyname, r.tablename, r.newname);
  end loop;
end $$;

-- ── 7 · is_project_member: the one function whose NAME (not just body)
--        spells the word. storage.objects' 9 menu/place-image policies call
--        it by regproc reference, so they re-point automatically. The
--        parameter STAYS `p_project_id`: Postgres refuses to rename an
--        input parameter via CREATE OR REPLACE (42P13, "use DROP FUNCTION
--        first"), and DROP here would cascade onto those 9 live policies.
--        Any RPC call site this sweep renames to `is_place_member` must
--        keep sending the payload key `p_project_id` — PostgREST maps RPC
--        JSON keys to parameter names literally.
alter function public.is_project_member(uuid) rename to is_place_member;

create or replace function public.is_place_member(p_project_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.place_members m
    where m.place_id = p_project_id
      and m.manager_id = (select auth.uid())
  );
$function$;

-- ── 8 · the eight remaining plpgsql/sql bodies that spell `projects` ───────
-- Each is its live definition with the renamed identifiers substituted and
-- nothing else touched.

create or replace function public.claim_place_into_org(p_place_id uuid, p_organization_id uuid, p_claimer uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_updated integer;
begin
  if exists (
    select 1 from public.place_members
     where place_id = p_place_id and role = 'owner'
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_claimable');
  end if;

  update public.places
     set organization_id = p_organization_id,
         claimed_by      = p_claimer,
         claimed_at      = now()
   where id = p_place_id
     and organization_id is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'code', 'race_lost');
  end if;

  insert into public.place_members (place_id, manager_id, role)
  values (p_place_id, p_claimer, 'owner')
  on conflict (place_id, manager_id) do update set role = 'owner';

  return jsonb_build_object('ok', true, 'claimed_at', now());
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'owner_conflict');
end;
$function$;

create or replace function public.release_place_from_org(p_place_id uuid, p_organization_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_claimed_at timestamptz;
  v_updated integer;
begin
  select claimed_at into v_claimed_at
    from public.places
   where id = p_place_id and organization_id = p_organization_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'race_lost');
  end if;

  if exists (
    select 1 from public.place_subscriptions
     where place_id = p_place_id
       and state in ('active', 'past_due')
       and cancel_at_period_end = false
  ) then
    return jsonb_build_object('ok', false, 'code', 'subscription_live');
  end if;

  update public.places
     set organization_id   = null,
         claimed_by        = null,
         claimed_at        = null,
         claim_reviewed_at = null,
         claim_reviewed_by = null,
         plan              = 'free'
   where id = p_place_id
     and organization_id = p_organization_id;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'code', 'race_lost');
  end if;

  if v_claimed_at is not null then
    delete from public.place_members
     where place_id = p_place_id
       and created_at >= v_claimed_at;
  end if;

  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.mark_place_claim_reviewed(p_place_id uuid, p_admin uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_updated integer;
begin
  update public.places
     set claim_reviewed_at = now(),
         claim_reviewed_by = p_admin
   where id = p_place_id
     and organization_id is not null
     and claimed_by is not null
     and claim_reviewed_at is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'code', 'not_claimed_or_reviewed');
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.profiles_insert()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_id uuid;
begin
  insert into public.place_profiles (
    id, created_at, updated_at, google_place_id, category, category_label,
    vibe, price_level, lat, lng, address, timezone, closes_at, phone, pitch, story,
    photos, website_url, instagram_url, facebook_url, whatsapp_url,
    opentable_url, resy_url, uber_eats_url, x_url, threads_url, reddit_url,
    google_maps_url, didi_food_url, email, hours, embedding,
    embedding_source_hash, embedding_source_text, country, description, menu_pdf_url, tags,
    whatsapp_pr_urls, instagram_pr_urls, google_business_url, google_stars_overall,
    google_review_count, google_visitor_count, mesita_stars_overall,
    mesita_stars_food, mesita_stars_service, mesita_stars_ambience,
    mesita_review_count, mesita_visitor_count, instagram_followers_count,
    menu_pdf_name, enriched_at, enrichment_sources, editorial_summary, zone, city,
    established_year, executive_chef, facebook_rating, facebook_followers,
    mesita_stars_value, details, google_reviews, menus, popular_times, products,
    google_name,
    description_es, mesita_name,
    reservation_channel, reservation_target, order_channel, order_target,
    business_state, business_state_at,
    name_embedding, name_embedding_hash,
    family_keys
  ) values (
    coalesce(new.id, gen_random_uuid()), coalesce(new.created_at, now()),
    coalesce(new.updated_at, now()), new.google_place_id, new.category,
    new.category_label, new.vibe, new.price_level, new.lat, new.lng, new.address,
    new.timezone, new.closes_at, new.phone, new.pitch, new.story,
    coalesce(new.photos, '{}'), new.website_url, new.instagram_url,
    new.facebook_url, new.whatsapp_url, new.opentable_url, new.resy_url,
    new.uber_eats_url, new.x_url, new.threads_url, new.reddit_url,
    new.google_maps_url, new.didi_food_url, new.email,
    new.hours, new.embedding, new.embedding_source_hash, new.embedding_source_text, new.country,
    new.description, new.menu_pdf_url, coalesce(new.tags, '{}'),
    coalesce(new.whatsapp_pr_urls, '{}'), coalesce(new.instagram_pr_urls, '{}'),
    new.google_business_url, new.google_stars_overall, new.google_review_count,
    new.google_visitor_count, new.mesita_stars_overall, new.mesita_stars_food,
    new.mesita_stars_service, new.mesita_stars_ambience, new.mesita_review_count,
    new.mesita_visitor_count, new.instagram_followers_count, new.menu_pdf_name,
    new.enriched_at, new.enrichment_sources, new.editorial_summary, new.zone,
    new.city, new.established_year, new.executive_chef, new.facebook_rating,
    new.facebook_followers, new.mesita_stars_value, new.details, new.google_reviews,
    new.menus, new.popular_times, new.products,
    new.google_name, new.description_es,
    coalesce(new.mesita_name, new.name),
    new.reservation_channel, new.reservation_target, new.order_channel, new.order_target,
    new.business_state, new.business_state_at,
    new.name_embedding, new.name_embedding_hash,
    new.family_keys
  ) returning id into v_id;

  insert into public.places (
    id, created_at, updated_at, slug, state, listing_type, plan, fiscal_type,
    content_state, currency, segmentation_basic_enabled,
    segmentation_advanced_enabled, welcome_free_rate, welcome_premium_rate,
    free_rate, premium_rate, monthly_promo_cap, discount_cap_cents
  ) values (
    v_id, coalesce(new.created_at, now()), coalesce(new.updated_at, now()),
    new.slug, coalesce(new.state, 'lead'::public.place_state),
    coalesce(new.listing_type, 'web'::public.listing_type),
    coalesce(new.plan, 'free'::public.plan),
    coalesce(new.fiscal_type, 'formal'::public.place_fiscal_type),
    coalesce(new.content_state, 'queued'::public.content_state),
    coalesce(new.currency, 'MXN'),
    coalesce(new.segmentation_basic_enabled, true),
    coalesce(new.segmentation_advanced_enabled, false), new.welcome_free_rate,
    new.welcome_premium_rate, new.free_rate, new.premium_rate,
    new.monthly_promo_cap, new.discount_cap_cents
  );
  new.id := v_id;
  return new;
end;
$function$;

create or replace function public.profiles_update()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update public.place_profiles set
    google_place_id = new.google_place_id, category = new.category,
    category_label = new.category_label, vibe = new.vibe, price_level = new.price_level,
    lat = new.lat, lng = new.lng, address = new.address, timezone = new.timezone,
    closes_at = new.closes_at, phone = new.phone, pitch = new.pitch, story = new.story,
    photos = new.photos, website_url = new.website_url, instagram_url = new.instagram_url,
    facebook_url = new.facebook_url,
    whatsapp_url = new.whatsapp_url, opentable_url = new.opentable_url,
    resy_url = new.resy_url, uber_eats_url = new.uber_eats_url, x_url = new.x_url,
    threads_url = new.threads_url, reddit_url = new.reddit_url,
    google_maps_url = new.google_maps_url,
    didi_food_url = new.didi_food_url, email = new.email, hours = new.hours,
    embedding = new.embedding, embedding_source_hash = new.embedding_source_hash,
    embedding_source_text = new.embedding_source_text,
    name_embedding = new.name_embedding,
    name_embedding_hash = new.name_embedding_hash,
    country = new.country, description = new.description, menu_pdf_url = new.menu_pdf_url,
    tags = new.tags, whatsapp_pr_urls = new.whatsapp_pr_urls,
    instagram_pr_urls = new.instagram_pr_urls, google_business_url = new.google_business_url,
    google_stars_overall = new.google_stars_overall, google_review_count = new.google_review_count,
    google_visitor_count = new.google_visitor_count, mesita_stars_overall = new.mesita_stars_overall,
    mesita_stars_food = new.mesita_stars_food, mesita_stars_service = new.mesita_stars_service,
    mesita_stars_ambience = new.mesita_stars_ambience, mesita_review_count = new.mesita_review_count,
    mesita_visitor_count = new.mesita_visitor_count, instagram_followers_count = new.instagram_followers_count,
    menu_pdf_name = new.menu_pdf_name, enriched_at = new.enriched_at,
    enrichment_sources = new.enrichment_sources, editorial_summary = new.editorial_summary,
    zone = new.zone, city = new.city, established_year = new.established_year,
    executive_chef = new.executive_chef, facebook_rating = new.facebook_rating,
    facebook_followers = new.facebook_followers, mesita_stars_value = new.mesita_stars_value,
    details = new.details, google_reviews = new.google_reviews, menus = new.menus,
    popular_times = new.popular_times, products = new.products,
    reservation_channel = new.reservation_channel,
    reservation_target = new.reservation_target,
    order_channel = new.order_channel,
    order_target = new.order_target,
    business_state = new.business_state,
    business_state_at = new.business_state_at,
    google_name = new.google_name,
    description_es = new.description_es,
    mesita_name = new.mesita_name,
    family_keys = new.family_keys
  where id = old.id;

  update public.places set
    slug = new.slug, state = new.state, listing_type = new.listing_type,
    plan = new.plan, fiscal_type = new.fiscal_type, content_state = new.content_state,
    currency = new.currency,
    segmentation_basic_enabled = new.segmentation_basic_enabled,
    segmentation_advanced_enabled = new.segmentation_advanced_enabled,
    welcome_free_rate = new.welcome_free_rate, welcome_premium_rate = new.welcome_premium_rate,
    free_rate = new.free_rate, premium_rate = new.premium_rate,
    monthly_promo_cap = new.monthly_promo_cap, discount_cap_cents = new.discount_cap_cents
  where id = old.id;
  return new;
end
$function$;

create or replace function public.queue_due_place_enrichments()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_row     record;
  v_stage   text;
  v_count   integer := 0;
  v_trigger jsonb;
  v_subs    jsonb;
  v_run_id  uuid;
begin
  select enrichment_triggers -> 'on_schedule'
    into v_trigger
    from public.app_config
   order by id
   limit 1;

  if v_trigger is null then
    v_subs := null;
  elsif coalesce((v_trigger ->> 'enabled')::boolean, true) is not true then
    return 0;
  else
    select coalesce(jsonb_agg(e.key order by e.key), '[]'::jsonb)
      into v_subs
      from jsonb_each(coalesce(v_trigger -> 'subprocesses', '{}'::jsonb)) as e(key, value)
     where e.value = 'true'::jsonb;

    if jsonb_array_length(v_subs) = 0 then
      return 0;
    end if;
  end if;

  for v_row in
    select p.id,
           p.google_place_id,
           p.enrich_mode,
           p.enrich_every_days,
           r.gathered is not null as has_gathered,
           r.analysis is not null as has_analysis
    from public.place_profiles p
    join public.places pr on pr.id = p.id
    left join public.place_research r on r.place_id = p.id
    where p.enrich_every_days is not null
      and p.enrich_next_at is not null
      and p.enrich_next_at <= now()
      and p.google_place_id is not null
      and p.google_place_id <> ''
      and pr.content_state <> 'generating'
      and (r.place_id is null or r.stage in ('done', 'failed'))
    order by p.enrich_next_at asc
    for update of p skip locked
    limit 5
  loop
    v_stage := case
      when v_row.enrich_mode = 'contents' and v_row.has_gathered and v_row.has_analysis then 'contents'
      when v_row.enrich_mode = 'analysis' and v_row.has_gathered then 'analysis'
      else 'research'
    end;

    -- MESITA-1185: open the run BEFORE seeding, so a seed that dies still leaves
    -- the history (and any future cooldown) having ticked. Cooldown hours are 0
    -- here on purpose: the schedule's own cadence IS
    -- place_profiles.enrich_every_days, and a second window would silently
    -- fight it.
    select o.run_id into v_run_id
      from public.open_place_enrichment_run(
             v_row.id, 'on_schedule', 'queue_due_place_enrichments',
             v_subs, v_stage, 0, null, '{}'::jsonb) o;

    -- Refused because a run is still open for this place. Skip WITHOUT
    -- re-stamping enrich_next_at, so the place stays due and is picked up on a
    -- later tick once the janitor or a terminal has closed the open run.
    if v_run_id is null then
      continue;
    end if;

    insert into public.place_research as pr2
      (place_id, google_place_id, stage, state, attempts, gathered, analysis, error, subprocesses, created_by, run_id, updated_at)
    values
      (v_row.id, v_row.google_place_id, v_stage, 'pending', 0,
       null, null, null, v_subs, 'queue_due_place_enrichments', v_run_id, now())
    on conflict (place_id) do update set
      google_place_id = excluded.google_place_id,
      stage        = excluded.stage,
      state        = 'pending',
      attempts     = 0,
      error        = null,
      gathered     = case when excluded.stage = 'research' then null else pr2.gathered end,
      analysis     = case when excluded.stage in ('research', 'analysis') then null else pr2.analysis end,
      subprocesses = excluded.subprocesses,
      created_by   = excluded.created_by,
      run_id       = excluded.run_id,
      updated_at   = now();

    update public.places
    set content_state = 'generating'
    where id = v_row.id;

    update public.place_profiles
    set enrich_next_at = now() + make_interval(days => v_row.enrich_every_days)
    where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

create or replace function public.run_place_enrichment_stages()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'net', 'vault'
as $function$
declare
  v_key   text;
  v_base  text := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-cron-enrich-place-';
  v_row   public.place_research%rowtype;
  v_stage text;
  v_count integer := 0;
begin
  with victims as (
    select place_id, stage, attempts
      from public.place_research
     where state = 'running'
       and stage in ('research','analysis','contents')
       and updated_at < now() - interval '10 minutes'
     for update
  ),
  reaped as (
    update public.place_research pr
       set state  = 'pending',
           stage  = case when v.attempts >= 4 then 'failed' else v.stage end,
           error  = case when v.attempts >= 4 then 'max attempts reached'
                         else 'reaped: stuck running' end
      from victims v
     where pr.place_id = v.place_id
    returning pr.run_id, v.stage as died_at, v.attempts
  )
  update public.place_enrichment_runs r
     set stage_reached = x.died_at,
         end_reason    = 'reaped at the attempts cap in stage ' || x.died_at
    from reaped x
   where r.id = x.run_id
     and r.ended_at is null
     and x.attempts >= 4;

  with victims as (
    select place_id, stage, error, run_id
      from public.place_research
     where state = 'pending'
       and stage in ('research','analysis','contents')
       and attempts >= 4
     for update
  ),
  capped as (
    update public.place_research pr
       set stage = 'failed',
           error = coalesce(v.error, 'max attempts reached')
      from victims v
     where pr.place_id = v.place_id
    returning v.run_id, v.stage as died_at, v.error as last_error
  )
  update public.place_enrichment_runs r
     set stage_reached = c.died_at,
         end_reason    = coalesce(c.last_error, 'max attempts reached')
    from capped c
   where r.id = c.run_id
     and r.ended_at is null;

  update public.places p
  set content_state = 'failed'
  from public.place_research r
  where r.place_id = p.id
    and r.stage = 'failed'
    and p.content_state = 'generating';

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'scheduler_service_role_key'
  limit 1;
  if v_key is null then
    raise warning 'run_place_enrichment_stages: vault secret scheduler_service_role_key missing';
    return 0;
  end if;

  foreach v_stage in array array['research','analysis','contents'] loop
    for v_row in
      select *
      from public.place_research
      where stage = v_stage
        and state = 'pending'
        and attempts < 4
      order by updated_at asc
      for update skip locked
      limit 2
    loop
      perform net.http_post(
        url     := v_base || v_stage,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_key,
          'X-Internal-Caller', 'supabase-cron'
        ),
        body    := jsonb_build_object('place_id', v_row.place_id),
        timeout_milliseconds := 30000
      );

      update public.place_research
      set state = 'running',
          attempts = attempts + 1,
          error = null
      where place_id = v_row.place_id;

      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$function$;

create or replace function public.admin_reset_database()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  keep_tables text[];
  wipe_tables text[];
  deleted_users bigint;
  missing_required text[];
begin
  select coalesce(array_agg(p.table_name order by p.table_name), '{}'::text[])
    into keep_tables
    from public.admin_reset_preserve p;

  if not ('admin_reset_preserve' = any (keep_tables)) then
    keep_tables := keep_tables || array['admin_reset_preserve'];
  end if;

  select array_agg(r order by r) into missing_required
    from unnest(array[
      'app_config',
      'super_admins',
      'classes',
      'consumer_plans',
      'place_plans',
      'place_categories',
      'place_super_categories',
      'place_tags',
      'consumer_code_counter'
    ]) r
   where not (r = any (keep_tables));
  if missing_required is not null then
    raise exception
      'admin_reset_preserve is missing required survivor(s): %. Refusing to wipe.',
      missing_required;
  end if;

  if not exists (select 1 from public.super_admins) then
    raise exception
      'super_admins is empty: the wipe would delete every auth user, including yours, and leave nobody able to re-grant admin. Refusing to wipe.';
  end if;

  select coalesce(array_agg(format('public.%I', c.relname) order by c.relname), '{}'::text[])
    into wipe_tables
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and not c.relispartition
     and c.relname <> all (keep_tables)
     and not exists (
       select 1 from pg_depend d
        where d.objid = c.oid
          and d.classid = 'pg_class'::regclass
          and d.deptype = 'e'
     );

  if coalesce(array_length(wipe_tables, 1), 0) > 0 then
    execute format(
      'truncate table %s restart identity cascade',
      array_to_string(wipe_tables, ', ')
    );
  end if;

  update public.consumer_code_counter set next_value = 0 where id = 1;

  update public.classes set rank = -1 - rank where rank >= 0;

  insert into public.classes
    (key, label, rank, follower_threshold, monthly_reservation_limit)
  values
    ('bronze',  'Bronze',  0,  null,  2),
    ('silver',  'Silver',  1,  1000, 10),
    ('gold',    'Gold',    2,  5000, 10),
    ('diamond', 'Diamond', 3, 20000, 10)
  on conflict (key) do update set
    label = excluded.label,
    rank  = excluded.rank;

  delete from public.classes
   where key not in ('bronze', 'silver', 'gold', 'diamond');

  insert into public.consumer_plans (key, label, price_cents, currency) values
    ('free',    'Free',       0, 'MXN'),
    ('premium', 'Premium', 5000, 'MXN')
  on conflict (key) do update set
    label = excluded.label;

  insert into public.place_plans (key, label, price_cents, currency) values
    ('pro',   'Partner', 100000, 'MXN'),
    ('ultra', 'Ultra',    500000, 'MXN')
  on conflict (key) do update set
    label = excluded.label;

  perform public.seed_place_super_categories();
  perform public.seed_place_categories();
  perform public.seed_place_tags();

  delete from auth.users u
  where not exists (
    select 1
    from public.super_admins sa
    where (u.email is not null and lower(u.email) = lower(sa.email))
       or (u.phone is not null and sa.phone is not null and u.phone = sa.phone)
       or (sa.user_id is not null and sa.user_id = u.id)
  );
  get diagnostics deleted_users = row_count;

  return jsonb_build_object(
    'ok', true,
    'truncated_tables', coalesce(array_length(wipe_tables, 1), 0),
    'preserved_tables', coalesce(array_length(keep_tables, 1), 0),
    'deleted_auth_users', deleted_users,
    'reset_at', now()
  );
end;
$function$;

-- ── 9 · the data-side twin of admin_reset_database's hardcoded list ────────
update public.admin_reset_preserve set table_name = 'place_plans' where table_name = 'project_plans';

-- ── 10 · self-check: no `project`-family object left in the schema ────────
do $$
declare v_bad text;
begin
  select string_agg(x, ', ') into v_bad from (
    select 'table:'||relname
      from pg_class
     where relkind in ('r','p') and relnamespace = 'public'::regnamespace
       and relname ~* '\yproject[a-z_]*\y'
    union all
    select 'type:'||typname
      from pg_type
     where typnamespace = 'public'::regnamespace and typname ~* '\yproject[a-z_]*\y'
    union all
    select 'column:'||attrelid::regclass::text||'.'||attname
      from pg_attribute
     where attrelid::regclass::text = any (array[
             'public.places','public.place_members','public.place_invites',
             'public.place_plans','public.place_strikes',
             'public.place_subscriptions','public.place_verifications'
           ])
       and not attisdropped and attname ~* '\yproject[a-z_]*\y'
    union all
    select 'constraint:'||conname
      from pg_constraint
     where connamespace = 'public'::regnamespace and conname ~* '\yproject[a-z_]*\y'
    union all
    select 'index:'||indexname
      from pg_indexes
     where schemaname = 'public' and indexname ~* '\yproject[a-z_]*\y'
    union all
    select 'trigger:'||tgname
      from pg_trigger
     where not tgisinternal and tgname ~* '\yproject[a-z_]*\y'
    union all
    select 'policy:'||schemaname||'.'||tablename||'.'||policyname
      from pg_policies
     where policyname ~* '\yproject[a-z_]*\y'
    union all
    select 'function:'||proname
      from pg_proc
     where pronamespace = 'public'::regnamespace
       and (proname ~* '\yproject[a-z_]*\y'
            or (prosrc ~* '\yproject[a-z_]*\y' and prosrc !~* 'projection'))
    union all
    select 'preserve_row:'||table_name
      from public.admin_reset_preserve
     where table_name ~* '\yproject[a-z_]*\y'
  ) s(x);
  if v_bad is not null then
    raise exception 'stale project-family object(s) still present after MESITA-1590: %', v_bad;
  end if;
end $$;
