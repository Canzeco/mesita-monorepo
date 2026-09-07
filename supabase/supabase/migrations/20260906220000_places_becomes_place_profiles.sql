-- MESITA-1593 — the Atlas half becomes `place_profiles`, alone, so the name
-- `places` is free for MESITA-1590 to give to the entity half.
--
-- WHY THIS SHIPS BY ITSELF. MESITA-1590 renames `projects` -> `places`. Doing
-- both in one transaction would mean a live table named `places` throughout,
-- so any reference this sweep missed would bind to the WRONG table under a
-- valid-looking name, silently, forever. Landing this rename alone removes
-- that window: between the two PRs no table named `places` exists, so a missed
-- reference is a hard error instead of a wrong answer. Typecheck and CI prove
-- the sweep is complete before the name is handed over.
--
-- WHAT FOLLOWS THE RENAME AND WHAT DOES NOT. Views and RLS policies store
-- parsed OID references, so `profiles` and `places_select_public_visible`
-- re-point themselves. PL/pgSQL bodies are plain TEXT (`pg_proc.prosrc`), so
-- they do not — the r2-renames -> stale-plpgsql pair proved it once already
-- (MESITA-1542). The five functions whose bodies spell `places` are rebuilt
-- below, in this same transaction. Verified against the live schema
-- 2026-09-06: those five are the complete set.
--
-- Constraint and index names do NOT follow a table rename either, and they are
-- not cosmetic here: index names are schema-unique, so leaving `places_pkey`
-- behind would collide when MESITA-1590 renames `projects_pkey` into it.
--
-- The 7 inbound FKs (place_enrichment_events, place_enrichment_runs,
-- place_media_assets, place_name_history, place_requests, place_research,
-- projects) re-point by OID and need no DDL.

-- ── 1 · the table ───────────────────────────────────────────────────────────
alter table public.places rename to place_profiles;

-- ── 2 · constraints (renaming a constraint renames the index it owns) ───────
-- A loop, not the hardcoded list this shipped with originally: CI's
-- from-scratch replay proved `places_business_state_check` exists on the
-- live catalog with no migration that ever created it under that name (drift
-- predating this issue, same species as MESITA-1594 — a constraint applied
-- ad-hoc and never mirrored). A hardcoded RENAME hard-fails a fresh replay
-- the moment history and the live catalog disagree on what exists. Renaming
-- whatever the live/replayed catalog actually carries makes this self-healing
-- against that drift instead of a second victim of it.
do $$
declare r record;
begin
  for r in
    select conname, replace(conname, 'places_', 'place_profiles_') as newname
      from pg_constraint
     where conrelid = 'public.place_profiles'::regclass
       and conname like 'places\_%' escape '\'
  loop
    execute format('alter table public.place_profiles rename constraint %I to %I', r.conname, r.newname);
  end loop;
end $$;

-- ── 3 · the standalone indexes (the two constraint-owned ones moved above) ──
-- IF EXISTS for the same reason as the constraint loop above.
alter index if exists public.places_country_idx        rename to place_profiles_country_idx;
alter index if exists public.places_embedding_hnsw     rename to place_profiles_embedding_hnsw;
alter index if exists public.places_enrich_due_idx     rename to place_profiles_enrich_due_idx;
alter index if exists public.places_lat_lng_idx        rename to place_profiles_lat_lng_idx;
alter index if exists public.places_name_embedding_hnsw rename to place_profiles_name_embedding_hnsw;

-- ── 4 · triggers and the policy ────────────────────────────────────────────
-- place_name_history_capture_trg keeps its name: it is named for what it
-- captures, not for the table it hangs on. Guarded existence checks, same
-- drift rationale as section 2 — neither ALTER TRIGGER nor ALTER POLICY
-- supports IF EXISTS on a rename.
do $$
begin
  if exists (
    select 1 from pg_trigger
     where tgrelid = 'public.place_profiles'::regclass and tgname = 'places_set_updated_at'
  ) then
    alter trigger places_set_updated_at on public.place_profiles rename to place_profiles_set_updated_at;
  end if;
  if exists (
    select 1 from pg_trigger
     where tgrelid = 'public.place_profiles'::regclass and tgname = 'places_sync_category_label'
  ) then
    alter trigger places_sync_category_label on public.place_profiles rename to place_profiles_sync_category_label;
  end if;
  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'place_profiles' and policyname = 'places_select_public_visible'
  ) then
    alter policy places_select_public_visible on public.place_profiles
      rename to place_profiles_select_public_visible;
  end if;
end $$;

-- ── 5 · the five PL/pgSQL bodies ───────────────────────────────────────────
-- Each is its live definition with `places` -> `place_profiles` and nothing
-- else touched. `projects` stays spelled as it is: MESITA-1590 owns that word.

create or replace function public.apply_place_request(p_consumer_id uuid, p_place_id uuid)
 returns table(inserted boolean, request_count integer)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  n integer;
  v_count integer;
begin
  insert into public.place_requests (consumer_id, place_id)
  values (p_consumer_id, p_place_id)
  on conflict (consumer_id, place_id) do nothing;
  get diagnostics n = row_count;

  if n > 0 then
    update public.place_profiles
       set request_count = place_profiles.request_count + 1
     where id = p_place_id
     returning place_profiles.request_count into v_count;
  else
    select p.request_count into v_count
      from public.place_profiles p
     where p.id = p_place_id;
  end if;

  inserted := n > 0;
  request_count := coalesce(v_count, 0);
  return next;
end;
$function$;

create or replace function public.refresh_place_mesita_reviews(p_project_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  update public.place_profiles p
  set mesita_review_count   = agg.n,
      mesita_stars_overall  = round(agg.overall::numeric, 1),
      mesita_stars_food     = round(agg.food::numeric, 1),
      mesita_stars_service  = round(agg.service::numeric, 1),
      mesita_stars_ambience = round(agg.ambience::numeric, 1),
      mesita_stars_value    = agg.value
  from (
    select
      count(*)        as n,
      avg(r.overall)  as overall,
      avg(r.food)     as food,
      avg(r.service)  as service,
      avg(r.ambience) as ambience,
      avg(r.value)    as value
    from public.ticket_reviews r
    where r.place_id = p_project_id
  ) agg
  where p.id = p_project_id;
end;
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
    join public.projects pr on pr.id = p.id
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

    update public.projects
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

  insert into public.projects (
    id, created_at, updated_at, slug, state, listing_type, plan, fiscal_type,
    content_state, currency, segmentation_basic_enabled,
    segmentation_advanced_enabled, welcome_free_rate, welcome_premium_rate,
    free_rate, premium_rate, monthly_promo_cap, discount_cap_cents
  ) values (
    v_id, coalesce(new.created_at, now()), coalesce(new.updated_at, now()),
    new.slug, coalesce(new.state, 'lead'::public.project_state),
    coalesce(new.listing_type, 'web'::public.listing_type),
    coalesce(new.plan, 'free'::public.plan),
    coalesce(new.fiscal_type, 'formal'::public.project_fiscal_type),
    coalesce(new.content_state, 'queued'::public.content_state),
    coalesce(new.currency, 'MXN'),
    coalesce(new.segmentation_basic_enabled, true),
    coalesce(new.segmentation_advanced_enabled, false), new.welcome_free_rate,
    new.welcome_premium_rate, new.free_rate, new.premium_rate,
    new.monthly_promo_cap, new.discount_cap_cents
  );
  new.id := v_id;
  return new;
end
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

  update public.projects set
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

comment on table public.place_profiles is
  'The physical / Atlas-sourced profile of a place (MESITA-1593, was `places`). '
  '1:1 with the owned Mesita entity on a shared primary key.';
