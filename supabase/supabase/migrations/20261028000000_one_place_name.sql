-- MESITA-2828 (parent MESITA-2826): one place name.
--
-- Pato, 2026-10-26: "cada perfil tiene un solo nombre editable". Since
-- 20260809203000 `name` was GENERATED as coalesce(mesita_name, google_name):
-- the operator's override lived in mesita_name, Google's label in google_name,
-- and the guest read the coalesce. Now:
--
-- * place_profiles.name is STORED and editable — the Mesita name. Create
--   seeds it from Google, the Description step refines it through the name
--   door (_shared/place-name-door.ts), the operator edits it in Single Place.
-- * mesita_name retires. Today's name (= the coalesce) is the backfill.
-- * google_name stays: Google's own label, refreshed on every Google read,
--   read only by Search as an alias — a query that matches the Google name
--   returns the profile under its Mesita name.
-- * A blank name follows Google (a BEFORE trigger), so a profile always has
--   a name and an operator clearing the field falls back to Google's label.

-- ── 1. name: generated → stored. DROP EXPRESSION keeps every row's current
--      value, which IS coalesce(mesita_name, google_name): the backfill. ──
alter table public.place_profiles alter column name drop expression;

alter table public.place_profiles
  drop constraint if exists place_profiles_name_source_present;

-- ── 2. A blank name follows Google ────────────────────────────────────
create or replace function public.place_profiles_name_fallback()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.name := coalesce(nullif(btrim(new.name), ''), nullif(btrim(new.google_name), ''));
  return new;
end
$function$;

drop trigger if exists place_profiles_name_fallback_trg on public.place_profiles;
create trigger place_profiles_name_fallback_trg
  before insert or update of name, google_name on public.place_profiles
  for each row execute function public.place_profiles_name_fallback();

-- The column stays NOT NULL: with neither a name nor a Google label the
-- write is refused, as place_profiles_name_source_present refused it before.
alter table public.place_profiles
  add constraint place_profiles_name_present check (btrim(name) <> '');

comment on column public.place_profiles.name is
  'MESITA-2828: the one Mesita name, stored and editable. Seeded from Google at Create, refined by the Description step through the name door unless the operator owns it, edited in Single Place. Blank ⇒ follows google_name (trigger).';
comment on column public.place_profiles.google_name is
  'MESITA-2828: Google''s own label, refreshed on every Google read. Never shown; Search matches it as an alias of the Mesita name.';

-- ── 3. The door's provenance key follows the column ───────────────────
update public.place_profiles
   set enrichment_sources = (enrichment_sources - 'mesita_name_inferred')
       || jsonb_build_object('name_inferred', enrichment_sources -> 'mesita_name_inferred')
 where enrichment_sources ? 'mesita_name_inferred';

-- ── 4. The writers name the stored column ─────────────────────────────
create or replace function public.profiles_insert()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_id uuid;
begin
  insert into public.place_profiles (
    id, created_at, updated_at, google_place_id, google_types, mesita_categories, prepay_enabled, payments_enabled, category, category_label,
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
    name_embedding,
    google_address, source_sync
  ) values (
    coalesce(new.id, gen_random_uuid()), coalesce(new.created_at, now()),
    coalesce(new.updated_at, now()), new.google_place_id, coalesce(new.google_types, '[]'::jsonb), coalesce(new.mesita_categories, '[]'::jsonb), coalesce(new.prepay_enabled, false), coalesce(new.payments_enabled, false), new.category,
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
    new.name_embedding,
    new.google_address, new.source_sync
  ) returning id into v_id;

  insert into public.places (
    id, created_at, updated_at, slug, state, content_state, currency, selected
  ) values (
    v_id, coalesce(new.created_at, now()), coalesce(new.updated_at, now()),
    new.slug, coalesce(new.state, 'active'::public.place_state),
    coalesce(new.content_state, 'generating'::public.content_state),
    coalesce(new.currency, 'MXN'),
    -- A new place is never Selected by itself: the mark is the operator's.
    coalesce(new.selected, false)
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
    google_place_id = new.google_place_id, google_types = new.google_types, mesita_categories = new.mesita_categories, prepay_enabled = new.prepay_enabled, payments_enabled = new.payments_enabled, category = new.category,
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
    name_embedding = new.name_embedding,
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
    currency = new.currency,
    selected = coalesce(new.selected, old.selected)
  where id = old.id;
  return new;
end
$function$;

-- ── 5. Rebuild the view without mesita_name, then drop the column ──────
-- A rebuild is the only way to remove a view column; it drops the INSTEAD
-- OF triggers and grants, so both are re-bound below (pgTAP pins them).

drop view if exists public.profiles;

alter table public.place_profiles drop column if exists mesita_name;

create view public.profiles with (security_invoker = true) as
 SELECT p.id,
    p.created_at,
    p.updated_at,
    p.google_place_id,
    p.google_types,
    p.mesita_categories,
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
    p.name_embedding,
    p.request_count,
    public.place_family_keys(p.family_keys, p.google_types, p.category) as family_keys,
    p.reservations_enabled,
    p.google_address,
    p.source_sync,
    u.selected,
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
     where table_schema = 'public' and table_name = 'place_profiles'
       and column_name = 'name' and is_generated = 'ALWAYS'
  ) then
    raise exception 'place_profiles.name is still generated (MESITA-2828)';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'place_profiles'
       and column_name = 'mesita_name'
  ) then
    raise exception 'place_profiles.mesita_name survived (MESITA-2828)';
  end if;
  if pg_get_viewdef('public.profiles'::regclass) like '%mesita_name%' then
    raise exception 'profiles still projects mesita_name (MESITA-2828)';
  end if;
  if pg_get_viewdef('public.profiles'::regclass) not like '%place_family_keys%' then
    raise exception 'profiles.family_keys no longer reads the stored families (MESITA-2827)';
  end if;
  if exists (select 1 from public.place_profiles where btrim(name) = '') then
    raise exception 'a place lost its name in the backfill (MESITA-2828)';
  end if;
end
$postflight$;
