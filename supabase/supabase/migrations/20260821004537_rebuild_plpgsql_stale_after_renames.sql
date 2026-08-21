-- #1012's rename wave (20260818091000_fix_mispointed_fks: place_research.project_id
-- -> place_id; 20260818092000_rename_entities: types membership -> plan,
-- content_gen_status -> content_status) renamed identifiers UNDER two PL/pgSQL
-- bodies. Stored bodies are text — a rename never rewrites them — and nothing
-- validates them until they execute:
--
--   * run_place_enrichment_stages(): the pg_cron dispatcher died on
--     "column r.project_id does not exist" every 20 s from 2026-08-18 23:06 UTC
--     (8,410 consecutive failed runs in the 7-day retention window) — the
--     enrichment pipeline was fully dead while stage EFs sat idle and correct.
--   * profiles_insert(): the INSTEAD OF INSERT trigger on the profiles view kept
--     casts to the two dropped type names, so ANY insert through the view failed
--     with `type "public.membership" does not exist` (latent — no deployed
--     caller inserts via the view today; creators write the base tables).
--
-- Both bodies below are the LIVE pg_get_functiondef output patched ONLY on the
-- dead identifiers — never a repo copy: these functions are re-declared by many
-- migrations and the live body is the cumulative truth. The dispatcher keeps
-- sending the HTTP payload KEY 'project_id' — that is the stage-EF contract
-- (readJson<{ project_id }> in supabase-cron-enrich-place-*); only the VALUE
-- now reads the renamed place_id column. CREATE OR REPLACE preserves ownership
-- and ACLs, so the July execute-revokes stay in force.
--
-- plpgsql_check (the engine behind `supabase db lint`) is installed so the
-- daily /doctor audit can sweep every stored body against the catalog and catch
-- this class statically; on 2026-08-20 the sweep flagged exactly these two
-- functions and nothing else. Its blindspot: dynamic SQL (EXECUTE strings).

create extension if not exists plpgsql_check with schema extensions;

CREATE OR REPLACE FUNCTION public.run_place_enrichment_stages()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net', 'vault'
AS $function$
declare
  v_key   text;
  v_base  text := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-cron-enrich-place-';
  v_row   public.place_research%rowtype;
  v_stage text;
  v_req   bigint;
  v_count integer := 0;
begin
  -- ── REAP: 'running' rows whose EF never reported back within the lease
  -- (10 min > the 400 s EF wall clock, so a live run is never stolen).
  -- attempts was bumped at claim time; at/over the cap → terminal 'failed'. ──
  update public.place_research
  set status = 'pending',
      stage  = case when attempts >= 4 then 'failed' else stage end,
      error  = case when attempts >= 4 then 'max attempts reached' else 'reaped: stuck running' end
  where status = 'running'
    and stage in ('research','analysis','contents')
    and updated_at < now() - interval '10 minutes';

  -- ── Crash-released rows at the attempts cap ('pending', attempts >= 4) can
  -- never be claimed again: fail them terminally, keeping the last crash
  -- error so the inspector shows WHY. ──
  update public.place_research
  set stage = 'failed',
      error = coalesce(error, 'max attempts reached')
  where status = 'pending'
    and stage in ('research','analysis','contents')
    and attempts >= 4;

  -- A newly-failed pipeline must not strand its place at 'generating'.
  update public.projects p
  set content_status = 'failed'
  from public.place_research r
  where r.place_id = p.id
    and r.stage = 'failed'
    and p.content_status = 'generating';

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
        and status = 'pending'
        and attempts < 4
      order by updated_at asc
      for update skip locked
      limit 2
    loop
      select net.http_post(
        url     := v_base || v_stage,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_key,
          'X-Internal-Caller', 'supabase-cron'
        ),
        body    := jsonb_build_object('project_id', v_row.place_id),
        timeout_milliseconds := 30000
      ) into v_req;

      update public.place_research
      set status = 'running',
          attempts = attempts + 1,
          error = null
      where place_id = v_row.place_id;

      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.profiles_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  insert into public.places (
    id, created_at, updated_at, google_place_id, category, category_label,
    vibe, price_level, lat, lng, address, timezone, closes_at, phone, pitch, story,
    photos, website_url, instagram_url, tiktok_url, facebook_url, whatsapp_url,
    opentable_url, resy_url, uber_eats_url, x_url, threads_url, reddit_url,
    google_maps_url, tripadvisor_url, didi_food_url, email, hours, embedding,
    embedding_source_hash, embedding_source_text, country, description, menu_pdf_url, tags,
    whatsapp_pr_urls, instagram_pr_urls, google_business_url, google_stars_overall,
    google_review_count, google_visitor_count, mesita_stars_overall,
    mesita_stars_food, mesita_stars_service, mesita_stars_ambience,
    mesita_review_count, mesita_visitor_count, instagram_followers_count,
    menu_pdf_name, enriched_at, enrichment_sources, editorial_summary, zone, city,
    established_year, executive_chef, facebook_rating, facebook_followers,
    mesita_stars_value, details, google_reviews, menus, popular_times, products,
    yelp_url, reservation_endpoint, reservation_contacts, manual_priority, google_name,
    description_es, mesita_name
  ) values (
    coalesce(new.id, gen_random_uuid()), coalesce(new.created_at, now()),
    coalesce(new.updated_at, now()), new.google_place_id, new.category,
    new.category_label, new.vibe, new.price_level, new.lat, new.lng, new.address,
    new.timezone, new.closes_at, new.phone, new.pitch, new.story,
    coalesce(new.photos, '{}'), new.website_url, new.instagram_url, new.tiktok_url,
    new.facebook_url, new.whatsapp_url, new.opentable_url, new.resy_url,
    new.uber_eats_url, new.x_url, new.threads_url, new.reddit_url,
    new.google_maps_url, new.tripadvisor_url, new.didi_food_url, new.email,
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
    new.menus, new.popular_times, new.products, new.yelp_url,
    new.reservation_endpoint, coalesce(new.reservation_contacts, '[]'::jsonb),
    coalesce(new.manual_priority, 0.1), new.google_name, new.description_es,
    coalesce(new.mesita_name, new.name)
  ) returning id into v_id;

  insert into public.projects (
    id, created_at, updated_at, slug, status, listing_type, plan, fiscal_type,
    content_status, requires_story, currency, segmentation_basic_enabled,
    segmentation_advanced_enabled, welcome_free_rate, welcome_premium_rate,
    free_rate, premium_rate, monthly_promo_cap, discount_cap_cents
  ) values (
    v_id, coalesce(new.created_at, now()), coalesce(new.updated_at, now()),
    new.slug, coalesce(new.status, 'lead'::public.project_status),
    coalesce(new.listing_type, 'web'::public.listing_type),
    coalesce(new.plan, 'free'::public.plan),
    coalesce(new.fiscal_type, 'formal'::public.project_fiscal_type),
    coalesce(new.content_status, 'queued'::public.content_status),
    coalesce(new.requires_story, false), coalesce(new.currency, 'MXN'),
    coalesce(new.segmentation_basic_enabled, true),
    coalesce(new.segmentation_advanced_enabled, false), new.welcome_free_rate,
    new.welcome_premium_rate, new.free_rate, new.premium_rate,
    new.monthly_promo_cap, new.discount_cap_cents
  );
  new.id := v_id;
  return new;
end
$function$;
