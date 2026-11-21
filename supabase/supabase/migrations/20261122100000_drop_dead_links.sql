-- MESITA-4569 (Pato: "completely deprecate resy, didi, x, threads, reddit …
-- those never existed"; TripAdvisor not added either: "fuck tripadvisor too
-- for the moment"). Live: no place held any of the five (0 of 263). The
-- `profiles` view and its two write functions name them, so the view is
-- rebuilt minus the five; its INSTEAD OF triggers and grants come back.

drop view if exists public.profiles;

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
    opentable_url, uber_eats_url,
    google_maps_url, hours, embedding,
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
    new.facebook_url, new.whatsapp_url, new.opentable_url,
    new.uber_eats_url,
    new.google_maps_url,
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
    uber_eats_url = new.uber_eats_url,
    google_maps_url = new.google_maps_url,
    hours = new.hours,
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

alter table public.place_profiles
  drop column if exists resy_url,
  drop column if exists didi_food_url,
  drop column if exists x_url,
  drop column if exists threads_url,
  drop column if exists reddit_url;

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
    p.uber_eats_url,
    p.google_maps_url,
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
    place_family_keys(p.family_keys, p.google_types, p.category) AS family_keys,
    p.reservations_enabled,
    p.google_address,
    p.source_sync,
    p.google_tags,
    u.boost_tier,
    p.google_source_types,
    COALESCE(p.profile_photo, p.photos[1]) AS profile_photo,
    p.foursquare_place_id,
    p.foursquare_url,
    p.foursquare_popularity,
    p.foursquare_popularity_at
   FROM places u
     JOIN place_profiles p ON p.id = u.id;

create trigger profiles_insert_trg instead of insert on public.profiles
  for each row execute function public.profiles_insert();
create trigger profiles_update_trg instead of update on public.profiles
  for each row execute function public.profiles_update();

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant all on public.profiles to service_role;
