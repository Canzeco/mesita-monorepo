-- MESITA-1542 — the columns follow the word (child of MESITA-1541, which moved
-- the noun): every *status* identifier Mesita owns becomes *state*. VALUES are
-- untouched everywhere — Google's OPERATIONAL and Stripe's subscription words
-- keep their vendor shapes; only the identifiers are ours.
--
-- PL/pgSQL bodies and view output names do NOT follow ALTER ... RENAME (the
-- r2-renames → stale-plpgsql pair proved it), so everything that spells a
-- renamed identifier is rebuilt here, in the same transaction.

-- 1 · Enums -------------------------------------------------------------------

alter type public.project_status      rename to project_state;
alter type public.content_status      rename to content_state;
alter type public.reservation_status  rename to reservation_state;
alter type public.story_status        rename to story_state;
alter type public.ticket_status       rename to ticket_state;
alter type public.verification_status rename to verification_state;

-- 2 · Columns -----------------------------------------------------------------

alter table public.projects                rename column status             to state;
alter table public.projects                rename column content_status     to content_state;
alter table public.places                  rename column business_status    to business_state;
alter table public.places                  rename column business_status_at to business_state_at;
alter table public.visit_tickets           rename column status             to state;
alter table public.visit_tickets           rename column story_status       to story_state;
alter table public.visit_tickets           rename column review_status      to review_state;
alter table public.reservation_tickets     rename column status             to state;
alter table public.reservation_tickets     rename column last_call_status   to last_call_state;
alter table public.project_verifications   rename column status             to state;
alter table public.place_research          rename column status             to state;
alter table public.place_enrichment_events rename column status             to state;
alter table public.place_media_assets      rename column status             to state;
alter table public.consumer_notifications  rename column status             to state;
alter table public.ticket_reports          rename column status             to state;
alter table public.consumer_subscriptions  rename column status             to state;
alter table public.project_subscriptions   rename column status             to state;

-- 3 · Index and constraint names follow ---------------------------------------

alter index public.projects_status_idx             rename to projects_state_idx;
alter index public.projects_adea_status_idx        rename to projects_adea_state_idx;
alter index public.visit_tickets_status_idx        rename to visit_tickets_state_idx;
alter index public.visit_tickets_story_status_idx  rename to visit_tickets_story_state_idx;
alter index public.visit_tickets_review_status_idx rename to visit_tickets_review_state_idx;
alter index public.place_media_assets_status_idx   rename to place_media_assets_state_idx;
alter index public.place_research_stage_status_idx rename to place_research_stage_state_idx;

alter table public.places                  rename constraint places_business_status_check         to places_business_state_check;
alter table public.place_enrichment_events rename constraint place_enrichment_events_status_check to place_enrichment_events_state_check;
alter table public.place_research          rename constraint place_research_status_check          to place_research_state_check;
alter table public.place_media_assets      rename constraint place_media_assets_status_check      to place_media_assets_state_check;
alter table public.consumer_notifications  rename constraint consumer_notifications_status_check  to consumer_notifications_state_check;
alter table public.ticket_reports          rename constraint ticket_reports_status_check          to ticket_reports_state_check;
alter table public.consumer_subscriptions  rename constraint consumer_subscriptions_status_check  to consumer_subscriptions_state_check;
alter table public.project_subscriptions   rename constraint project_subscriptions_status_check   to project_subscriptions_state_check;

-- 4 · profiles ----------------------------------------------------------------
-- Output-column renames cannot ride CREATE OR REPLACE; the view is dropped
-- (its INSTEAD OF triggers go with it) and rebuilt. The rebuild MUST keep
-- security_invoker = true — dropping it silently reopens the consumer-browse
-- leak (supabase/CLAUDE.md invariant) — and MUST restate the grants, which
-- die with the view.

drop view public.profiles;

create view public.profiles with (security_invoker = true) as
 select p.id,
    p.created_at,
    p.updated_at,
    p.google_place_id,
    u.slug,
    p.name,
    p.category,
    p.vibe,
    p.price_level,
    u.listing_type,
    u.state,
    p.lat,
    p.lng,
    p.address,
    p.timezone,
    p.closes_at,
    p.phone,
    p.pitch,
    p.story,
    p.photos,
    p.website_url,
    p.instagram_url,
    p.facebook_url,
    p.whatsapp_url,
    p.opentable_url,
    p.resy_url,
    p.uber_eats_url,
    u.fiscal_type,
    u.plan,
    p.x_url,
    p.threads_url,
    p.reddit_url,
    p.google_maps_url,
    p.didi_food_url,
    p.email,
    p.hours,
    p.embedding,
    p.embedding_source_hash,
    p.country,
    p.description,
    p.menu_pdf_url,
    p.tags,
    p.whatsapp_pr_urls,
    p.instagram_pr_urls,
    p.google_business_url,
    p.google_stars_overall,
    p.google_review_count,
    p.google_visitor_count,
    p.mesita_stars_overall,
    p.mesita_stars_food,
    p.mesita_stars_service,
    p.mesita_stars_ambience,
    p.mesita_review_count,
    p.mesita_visitor_count,
    p.instagram_followers_count,
    u.segmentation_basic_enabled,
    u.segmentation_advanced_enabled,
    u.currency,
    p.menu_pdf_name,
    u.welcome_free_rate,
    u.welcome_premium_rate,
    u.free_rate,
    u.premium_rate,
    p.enriched_at,
    p.enrichment_sources,
    p.editorial_summary,
    p.zone,
    p.city,
    p.established_year,
    p.executive_chef,
    u.discount_cap_cents,
    p.facebook_rating,
    p.facebook_followers,
    p.mesita_stars_value,
    p.details,
    p.google_reviews,
    p.menus,
    p.popular_times,
    u.monthly_promo_cap,
    p.products,
    p.category_label,
    u.content_state,
    u.staff_channel_pinged_at,
    u.first_ticket_honored_at,
    u.plan_live_at,
    u.strike_count,
    u.last_strike_at,
    u.promo_paused_until,
    u.plan_forfeited_at,
    p.embedding_source_text,
    p.google_name,
    p.description_es,
    p.mesita_name,
    p.reservation_channel,
    p.reservation_target,
    p.order_channel,
    p.order_target,
    p.business_state,
    p.business_state_at,
    p.name_embedding,
    p.name_embedding_hash,
    null::text as tiktok_url,
    null::text as tripadvisor_url,
    null::text as yelp_url,
    false as requires_story,
    p.request_count,
    p.family_keys,
    p.orders_enabled,
    p.reservations_enabled,
    u.reward_lane_pending_review_at
   from public.projects u
   join public.places p on p.id = u.id;

grant select on public.profiles to anon, authenticated;
grant all on public.profiles to service_role;

-- 5 · The INSTEAD OF trigger functions spell every column; rebuilt, then the
--     triggers themselves (CREATE OR REPLACE keeps the functions' ACLs).

create or replace function public.profiles_insert()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_id uuid;
begin
  insert into public.places (
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
$$;

create or replace function public.profiles_update()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  update public.places set
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
$$;

create trigger profiles_insert_trg
  instead of insert on public.profiles
  for each row execute function public.profiles_insert();

create trigger profiles_update_trg
  instead of update on public.profiles
  for each row execute function public.profiles_update();

-- 6 · place_enrich_events_latest returns a column literally named status; a
--     return-type change cannot ride CREATE OR REPLACE. Dropped and recreated,
--     with its service_role-only ACL restated (it dies with the function).

drop function public.place_enrich_events_latest(uuid[]);

create function public.place_enrich_events_latest(p_place_ids uuid[])
 returns table(place_id uuid, step_name text, state text, created_at timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $$
  select distinct on (e.place_id, e.step_name)
         e.place_id,
         e.step_name,
         e.state,
         e.created_at
    from public.place_enrichment_events e
   where e.place_id = any (coalesce(p_place_ids, '{}'::uuid[]))
   order by e.place_id, e.step_name, e.created_at desc;
$$;

revoke execute on function public.place_enrich_events_latest(uuid[]) from public, anon, authenticated;
grant execute on function public.place_enrich_events_latest(uuid[]) to service_role;

-- 7 · The cron-driven pipeline functions spell the renamed columns in their
--     bodies; rebuilt verbatim with the new names. The cron jobs themselves
--     call these by (unchanged) function name and do not move.

create or replace function public.queue_due_place_enrichments()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $$
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
    from public.places p
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
    -- here on purpose: the schedule's own cadence IS places.enrich_every_days,
    -- and a second window would silently fight it.
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

    update public.places
    set enrich_next_at = now() + make_interval(days => v_row.enrich_every_days)
    where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.run_place_enrichment_stages()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'net', 'vault'
as $$
declare
  v_key   text;
  v_base  text := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-cron-enrich-place-';
  v_row   public.place_research%rowtype;
  v_stage text;
  v_count integer := 0;
begin
  -- ── REAP: 'running' rows whose EF never reported back within the lease
  -- (10 min > the 400 s EF wall clock, so a live run is never stolen).
  -- attempts was bumped at claim time; at/over the cap → terminal 'failed'.
  --
  -- The victims CTE reads `stage` BEFORE the overwrite so the run row can
  -- record WHICH stage died (MESITA-1241). Without it stage_reached could only
  -- ever say 'failed', which is the outcome, not the location.
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

  -- ── Crash-released rows at the attempts cap ('pending', attempts >= 4) can
  -- never be claimed again: fail them terminally, keeping the last crash
  -- error so the inspector shows WHY. Same capture-then-overwrite shape. ──
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

  -- A newly-failed pipeline must not strand its place at 'generating'.
  update public.projects p
  set content_state = 'failed'
  from public.place_research r
  where r.place_id = p.id
    and r.stage = 'failed'
    and p.content_state = 'generating';

  -- ── Service bearer from Vault (shared with the creation scheduler). ──
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'scheduler_service_role_key'
  limit 1;
  if v_key is null then
    raise warning 'run_place_enrichment_stages: vault secret scheduler_service_role_key missing';
    return 0;
  end if;

  -- ── Claim + fire, per stage. SKIP LOCKED keeps overlapping ticks disjoint.
  -- Small per-stage batches: the stage EFs each burn real API budget. ──
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
        body    := jsonb_build_object('project_id', v_row.place_id),
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
$$;

-- 8 · One-time backfill: places.enrichment blobs written before this rename
--     spell the per-function field (and blockedAt's) as `status`. The read
--     side folds the legacy spelling (schema-catalog.ts foldLegacyStateSpelling),
--     but admin-web-search-places and business-web-get-overview ship these
--     blobs verbatim, so the stored spelling is rewritten once here and the
--     fold becomes belt-and-suspenders. Replay-safe: on an empty table this
--     touches nothing.

update public.places
set enrichment =
  jsonb_set(
    jsonb_set(
      enrichment,
      '{functions}',
      coalesce(
        (select jsonb_object_agg(
                  f.k,
                  case
                    when jsonb_typeof(f.v) = 'object' and f.v ? 'status' and not f.v ? 'state'
                      then (f.v - 'status') || jsonb_build_object('state', f.v -> 'status')
                    else f.v
                  end)
           from jsonb_each(enrichment -> 'functions') as f(k, v)),
        enrichment -> 'functions',
        '{}'::jsonb)
    ),
    '{blockedAt}',
    case
      when jsonb_typeof(enrichment -> 'blockedAt') = 'object'
           and (enrichment -> 'blockedAt') ? 'status'
           and not (enrichment -> 'blockedAt') ? 'state'
        then ((enrichment -> 'blockedAt') - 'status')
             || jsonb_build_object('state', (enrichment -> 'blockedAt') -> 'status')
      else coalesce(enrichment -> 'blockedAt', 'null'::jsonb)
    end
  )
where jsonb_typeof(enrichment -> 'functions') = 'object'
  and (
    exists (select 1
              from jsonb_each(enrichment -> 'functions') as g(k, v)
             where jsonb_typeof(g.v) = 'object' and g.v ? 'status')
    or (jsonb_typeof(enrichment -> 'blockedAt') = 'object'
        and (enrichment -> 'blockedAt') ? 'status')
  );
