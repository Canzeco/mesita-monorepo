-- MESITA-1211 — CONTRACT: the legacy reservation pair leaves the schema.
--
-- places.reservation_endpoint / reservation_contacts (20260710025836) were added
-- to carry reservation routing, abandoned in favour of the products jsonb, and
-- superseded for good by the typed reservation_channel / reservation_target pair
-- (MESITA-1208). Nothing reads them any more: the same change removed their
-- entries from _shared/place-columns.ts — the one projection every public and
-- business read is built from — dropped the two validation branches out of
-- business-web-update-project, and stopped the admin Reservations card nulling
-- them on every save. In the database, public.profiles is their ONLY dependent:
-- no policy, index, constraint or other function mentions either name.
--
-- Rows carrying a value: 0 for both. Schema-only; there is nothing to migrate.
--
-- Why this is not a create-or-replace: that form is append-only on a view's
-- column list, so REMOVING a column needs DROP VIEW + recreate. Dropping the
-- view also drops the anon/authenticated SELECT grants, the service_role write
-- grants, both INSTEAD OF triggers, the view comment and the
-- `security_invoker = true` reloption. Every one is restored below and then
-- re-asserted, because a grant silently lost here is a 403 on every public
-- place read.
--
-- Why the view body is not spelled out: public.profiles is the most contended
-- object in this schema — it gains columns from several unrelated changes a
-- week, and this file would be stale by the time it merged. Pasting a snapshot
-- of the column list and re-creating from it does not just go stale, it DELETES
-- whatever landed after the snapshot was taken, silently. So the rebuild reads
-- the LIVE definition at the moment it runs and removes exactly two lines from
-- it, refusing to run at all if it cannot find them. That is drift-proof under
-- replay (every earlier migration builds the view first) and under a concurrent
-- schema change.
--
-- The two PL/pgSQL bodies ARE spelled out, and must be: they carry an INSERT
-- whose column list and VALUES list correspond by position, so a text edit that
-- half-applies produces a body that only fails the first time a place is
-- created. They are the LIVE pg_get_functiondef output (Dev Rules §B — bodies
-- are cumulative and are never rebuilt from an older repo copy), verbatim
-- except for the two dropped columns.

-- ━━━ 1 · drop the view + the columns, then rebuild the view from the live
--         definition minus exactly those two lines ━━━━━━━━━━━━━━━━━━━━━━━━━━
do $$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_viewdef('public.profiles'::regclass, true);

  v_new := regexp_replace(v_def, '[ \t]*p\.reservation_endpoint,[ \t]*\r?\n', '');
  v_new := regexp_replace(v_new, '[ \t]*p\.reservation_contacts,[ \t]*\r?\n', '');

  -- Both lines must have gone, and nothing else may still name them. If the
  -- view has already stopped projecting the pair, this migration is stale and
  -- must not proceed to drop columns something else may now depend on.
  if v_new = v_def then
    raise exception
      'public.profiles does not project the legacy reservation pair; MESITA-1211 is stale';
  end if;
  if v_new like '%reservation_endpoint%' or v_new like '%reservation_contacts%' then
    raise exception
      'could not strip the legacy reservation pair from the public.profiles definition';
  end if;

  -- Takes both INSTEAD OF triggers, the grants, the comment and the reloption.
  drop view public.profiles;

  alter table public.places
    drop column reservation_endpoint,
    drop column reservation_contacts;

  -- INVARIANT (carried from the live definition): security_invoker = true.
  execute 'create view public.profiles with (security_invoker = true) as ' || v_new;
end
$$;

comment on view public.profiles is
  'SECURITY INVOKER join of projects ⋈ places. Public reads follow projects_select_public_visible; service-role EFs bypass RLS. INVARIANT: any create-or-replace MUST keep with (security_invoker = true).';

-- ━━━ 2 · restore the grants DROP VIEW took ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- postgres (the owner) and service_role are re-granted by the public-schema
-- default ACL when the view is created; anon and authenticated are NOT, so the
-- SELECT below is the grant that actually has to be here. Both are stated so
-- the live ACL — postgres + service_role: all · anon + authenticated: select —
-- reads off this file instead of being inferred from a default.
grant select on public.profiles to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on public.profiles to service_role;

-- ━━━ 3 · rebuild both INSTEAD OF bodies, then rebind the triggers ━━━━━━━━━━

create or replace function public.profiles_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    yelp_url, manual_priority, google_name,
    description_es, mesita_name,
    reservation_channel, reservation_target, order_channel, order_target
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
    coalesce(new.manual_priority, 0.1), new.google_name, new.description_es,
    coalesce(new.mesita_name, new.name),
    new.reservation_channel, new.reservation_target, new.order_channel, new.order_target
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

create or replace function public.profiles_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.places set
    google_place_id = new.google_place_id, category = new.category,
    category_label = new.category_label, vibe = new.vibe, price_level = new.price_level,
    lat = new.lat, lng = new.lng, address = new.address, timezone = new.timezone,
    closes_at = new.closes_at, phone = new.phone, pitch = new.pitch, story = new.story,
    photos = new.photos, website_url = new.website_url, instagram_url = new.instagram_url,
    tiktok_url = new.tiktok_url, facebook_url = new.facebook_url,
    whatsapp_url = new.whatsapp_url, opentable_url = new.opentable_url,
    resy_url = new.resy_url, uber_eats_url = new.uber_eats_url, x_url = new.x_url,
    threads_url = new.threads_url, reddit_url = new.reddit_url,
    google_maps_url = new.google_maps_url, tripadvisor_url = new.tripadvisor_url,
    didi_food_url = new.didi_food_url, email = new.email, hours = new.hours,
    embedding = new.embedding, embedding_source_hash = new.embedding_source_hash,
    embedding_source_text = new.embedding_source_text,
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
    popular_times = new.popular_times, products = new.products, yelp_url = new.yelp_url,
    reservation_channel = new.reservation_channel,
    reservation_target = new.reservation_target,
    order_channel = new.order_channel,
    order_target = new.order_target,
    manual_priority = coalesce(new.manual_priority, 0.1),
    google_name = new.google_name,
    description_es = new.description_es,
    mesita_name = new.mesita_name
  where id = old.id;

  update public.projects set
    slug = new.slug, status = new.status, listing_type = new.listing_type,
    plan = new.plan, fiscal_type = new.fiscal_type, content_status = new.content_status,
    requires_story = new.requires_story, currency = new.currency,
    segmentation_basic_enabled = new.segmentation_basic_enabled,
    segmentation_advanced_enabled = new.segmentation_advanced_enabled,
    welcome_free_rate = new.welcome_free_rate, welcome_premium_rate = new.welcome_premium_rate,
    free_rate = new.free_rate, premium_rate = new.premium_rate,
    monthly_promo_cap = new.monthly_promo_cap, discount_cap_cents = new.discount_cap_cents
  where id = old.id;
  return new;
end
$function$;

create trigger profiles_insert_trg
  instead of insert on public.profiles
  for each row execute function public.profiles_insert();

create trigger profiles_update_trg
  instead of update on public.profiles
  for each row execute function public.profiles_update();

-- ━━━ 4 · prove the invariants survived ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'profiles'
      and c.reloptions @> array['security_invoker=true']
  ) then
    raise exception 'public.profiles lost security_invoker = true';
  end if;

  if (
    select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'profiles'
      and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'
  ) <> 2 then
    raise exception 'public.profiles lost the anon/authenticated SELECT grant';
  end if;

  if (
    select count(*) from pg_trigger
    where tgrelid = 'public.profiles'::regclass and not tgisinternal
  ) <> 2 then
    raise exception 'public.profiles did not get both INSTEAD OF triggers back';
  end if;
end
$$;

notify pgrst, 'reload schema';
