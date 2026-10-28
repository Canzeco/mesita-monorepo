-- MESITA-2959: drop place_profiles.mesita_categories.
--
-- Since 20261027060000_google_categories_stored_families.sql nothing writes or
-- reads it: families are stored on place_profiles.family_keys and Google's
-- categories on google_types. Live 2026-10-28: the only objects naming it were
-- the profiles view and its two INSTEAD OF writers (plus the column's own
-- default); 0 rows held a non-empty list. No EF, app or Render source reads it.
--
-- Bodies copied from 20261028210000_drop_places_selected.sql (the last
-- definition of the view and its writers) with the mesita_categories lines
-- removed.

-- ── 1. The writers stop naming the column ─────────────────────────────
create or replace function public.profiles_insert()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_id uuid;
begin
  insert into public.place_profiles (
    id, created_at, updated_at, google_place_id, google_types, prepay_enabled, payments_enabled, category, category_label,
    price_level, lat, lng, address, timezone, closes_at, phone, pitch, story,
    photos, website_url, instagram_url, facebook_url, whatsapp_url,
    opentable_url, resy_url, uber_eats_url, x_url, threads_url, reddit_url,
    google_maps_url, didi_food_url, hours, embedding,
    embedding_source_text, description, menu_pdf_url, tags,
    google_stars_overall, google_review_count, instagram_followers_count,
    menu_pdf_name, enriched_at, enrichment_sources, zone, city,
    facebook_followers,
    google_reviews, menus, popular_times, products,
    google_name, name,
    reservation_channel, reservation_target,
    business_state, business_state_at,
    google_address, source_sync
  ) values (
    coalesce(new.id, gen_random_uuid()), coalesce(new.created_at, now()),
    coalesce(new.updated_at, now()), new.google_place_id, coalesce(new.google_types, '[]'::jsonb), coalesce(new.prepay_enabled, false), coalesce(new.payments_enabled, false), new.category,
    new.category_label, new.price_level, new.lat, new.lng, new.address,
    new.timezone, new.closes_at, new.phone, new.pitch, new.story,
    coalesce(new.photos, '{}'), new.website_url, new.instagram_url,
    new.facebook_url, new.whatsapp_url, new.opentable_url, new.resy_url,
    new.uber_eats_url, new.x_url, new.threads_url, new.reddit_url,
    new.google_maps_url, new.didi_food_url,
    new.hours, new.embedding, new.embedding_source_text,
    new.description, new.menu_pdf_url, coalesce(new.tags, '{}'),
    new.google_stars_overall, new.google_review_count, new.instagram_followers_count,
    new.menu_pdf_name, new.enriched_at, new.enrichment_sources,
    new.zone, new.city,
    new.facebook_followers,
    new.google_reviews, new.menus, new.popular_times, new.products,
    new.google_name,
    new.name,
    new.reservation_channel, new.reservation_target,
    new.business_state, new.business_state_at,
    new.google_address, new.source_sync
  ) returning id into v_id;

  insert into public.places (
    id, created_at, updated_at, slug, state, content_state, currency
  ) values (
    v_id, coalesce(new.created_at, now()), coalesce(new.updated_at, now()),
    new.slug, coalesce(new.state, 'active'::public.place_state),
    coalesce(new.content_state, 'generating'::public.content_state),
    coalesce(new.currency, 'MXN')
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
    google_place_id = new.google_place_id, google_types = new.google_types, prepay_enabled = new.prepay_enabled, payments_enabled = new.payments_enabled, category = new.category,
    category_label = new.category_label, price_level = new.price_level,
    lat = new.lat, lng = new.lng, address = new.address, timezone = new.timezone,
    closes_at = new.closes_at, phone = new.phone, pitch = new.pitch, story = new.story,
    photos = new.photos, website_url = new.website_url, instagram_url = new.instagram_url,
    facebook_url = new.facebook_url,
    whatsapp_url = new.whatsapp_url, opentable_url = new.opentable_url,
    resy_url = new.resy_url, uber_eats_url = new.uber_eats_url, x_url = new.x_url,
    threads_url = new.threads_url, reddit_url = new.reddit_url,
    google_maps_url = new.google_maps_url,
    didi_food_url = new.didi_food_url, hours = new.hours,
    embedding = new.embedding,
    embedding_source_text = new.embedding_source_text,
    description = new.description, menu_pdf_url = new.menu_pdf_url,
    tags = new.tags,
    google_stars_overall = new.google_stars_overall, google_review_count = new.google_review_count,
    instagram_followers_count = new.instagram_followers_count,
    menu_pdf_name = new.menu_pdf_name, enriched_at = new.enriched_at,
    enrichment_sources = new.enrichment_sources,
    zone = new.zone, city = new.city,
    facebook_followers = new.facebook_followers,
    google_reviews = new.google_reviews, menus = new.menus,
    popular_times = new.popular_times, products = new.products,
    reservation_channel = new.reservation_channel,
    reservation_target = new.reservation_target,
    business_state = new.business_state,
    business_state_at = new.business_state_at,
    google_name = new.google_name,
    name = new.name,
    google_address = new.google_address,
    source_sync = new.source_sync
  where id = old.id;
  update public.places set
    slug = new.slug, state = new.state, content_state = new.content_state,
    currency = new.currency
  where id = old.id;
  return new;
end
$function$;

-- ── 2. Rebuild the view without mesita_categories, then drop the column ────────
-- A rebuild is the only way to remove a view column; it drops the INSTEAD
-- OF triggers and grants, so both are re-bound below (pgTAP pins them).

drop view if exists public.profiles;

alter table public.place_profiles drop column if exists mesita_categories;

create view public.profiles with (security_invoker = true) as
 SELECT p.id,
    p.created_at,
    p.updated_at,
    p.google_place_id,
    p.google_types,
    p.prepay_enabled,
    p.payments_enabled,
    u.slug,
    p.name,
    p.category,
    p.price_level,
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
    p.x_url,
    p.threads_url,
    p.reddit_url,
    p.google_maps_url,
    p.didi_food_url,
    p.hours,
    p.embedding,
    p.description,
    p.menu_pdf_url,
    p.tags,
    p.google_stars_overall,
    p.google_review_count,
    p.instagram_followers_count,
    u.currency,
    p.menu_pdf_name,
    p.enriched_at,
    p.enrichment_sources,
    p.zone,
    p.city,
    p.facebook_followers,
    p.google_reviews,
    p.menus,
    p.popular_times,
    p.products,
    p.category_label,
    u.content_state,
    p.embedding_source_text,
    p.google_name,
    p.reservation_channel,
    p.reservation_target,
    p.business_state,
    p.business_state_at,
    p.request_count,
    public.place_family_keys(p.family_keys, p.google_types, p.category) as family_keys,
    p.reservations_enabled,
    p.google_address,
    p.source_sync,
    p.google_tags,
    u.boost_tier,
    p.google_source_types
   FROM places u
     JOIN place_profiles p ON p.id = u.id;

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on table public.profiles to service_role;

drop trigger if exists profiles_insert_trg on public.profiles;
create trigger profiles_insert_trg
  instead of insert on public.profiles
  for each row execute function public.profiles_insert();

drop trigger if exists profiles_update_trg on public.profiles;
create trigger profiles_update_trg
  instead of update on public.profiles
  for each row execute function public.profiles_update();

do $postflight$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name in ('place_profiles', 'profiles')
       and column_name = 'mesita_categories'
  ) then
    raise exception 'mesita_categories survived (MESITA-2959)';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosrc ~* 'mesita_categories'
  ) then
    raise exception 'a public function still names mesita_categories (MESITA-2959)';
  end if;
  if pg_get_viewdef('public.profiles'::regclass) not like '%place_family_keys%' then
    raise exception 'profiles.family_keys no longer reads place_family_keys';
  end if;
  if not exists (
    select 1 from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_insert_trg'
  ) or not exists (
    select 1 from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_update_trg'
  ) then
    raise exception 'profiles lost an INSTEAD OF writer (MESITA-2959)';
  end if;
end
$postflight$;
