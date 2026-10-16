-- Families are the category ↔ family dictionary. A place stores one category
-- and its tags. The profiles view derives family_keys from that dictionary,
-- so editing the dictionary reorganizes the catalog without rewriting places.
-- source_sync is the last manual or staged sync. google_address keeps the
-- structured Google location. Neither column copies an LLM rewrite.

create or replace function public.families_for_category(cat text)
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select family_keys from public.place_categories where slug = cat),
    array['undefined']::text[]
  );
$$;

comment on function public.families_for_category(text) is
  'Catalog membership for one category. Reads place_categories.family_keys. Does not read place_profiles.';

revoke execute on function public.families_for_category(text) from public;
grant execute on function public.families_for_category(text) to anon, authenticated, service_role;

alter table public.place_profiles
  add column if not exists google_address jsonb,
  add column if not exists source_sync jsonb;

comment on column public.place_profiles.google_address is
  'Google Places location as returned: formattedAddress, location, addressComponents. Not an LLM rewrite.';
comment on column public.place_profiles.source_sync is
  'Last sync of Google, Instagram, and Facebook volatile fields. Not a profile preference.';

do $undefined_category$
begin
  if not exists (select 1 from public.place_categories where slug = 'undefined') then
    raise exception 'category undefined is missing; empty categories were not rewritten';
  end if;
end
$undefined_category$;

-- Keep the address string and coordinates we already stored. Do not invent
-- component types from zone or city. These backfills must not look like edits.
alter table public.place_profiles disable trigger place_profiles_set_updated_at;

update public.place_profiles
   set google_address = jsonb_strip_nulls(jsonb_build_object(
         'formattedAddress', nullif(btrim(address), ''),
         'location', case
           when lat is not null and lng is not null
             then jsonb_build_object('latitude', lat, 'longitude', lng)
           else null
         end
       ))
 where google_address is null
   and (nullif(btrim(address), '') is not null or (lat is not null and lng is not null));

update public.place_profiles
   set category = 'undefined'
 where category is null or btrim(category) = '';

-- The column is not the catalog. Clear copies so a base-table read cannot
-- disagree with the mapping. The view derives membership either way.
update public.place_profiles
   set family_keys = null
 where family_keys is not null;

alter table public.place_profiles enable trigger place_profiles_set_updated_at;

create or replace function public.place_profiles_taxonomy()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.category is null or btrim(new.category) = '' then
    new.category := 'undefined';
  end if;
  if tg_op = 'INSERT' or new.category is distinct from old.category then
    if not exists (select 1 from public.place_categories c where c.slug = new.category) then
      raise exception 'unknown category %', new.category;
    end if;
  end if;
  if tg_op = 'INSERT' or new.tags is distinct from old.tags then
    if exists (
      select 1
        from unnest(coalesce(new.tags, '{}'::text[])) as tag(slug)
       where not exists (select 1 from public.place_tags pt where pt.slug = tag.slug)
    ) then
      raise exception 'unknown tag';
    end if;
  end if;
  new.family_keys := null;
  return new;
end;
$$;

drop trigger if exists place_profiles_taxonomy_trg on public.place_profiles;
create trigger place_profiles_taxonomy_trg
  before insert or update on public.place_profiles
  for each row execute function public.place_profiles_taxonomy();

-- The view and its INSTEAD OF writers. family_keys is computed. The base
-- column is cleared by the taxonomy trigger and is not the catalog.

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
    price_level, lat, lng, address, timezone, closes_at, phone, pitch, story,
    photos, website_url, instagram_url, facebook_url, whatsapp_url,
    opentable_url, resy_url, uber_eats_url, x_url, threads_url, reddit_url,
    google_maps_url, didi_food_url, hours, embedding,
    embedding_source_hash, embedding_source_text, description, menu_pdf_url, tags,
    google_stars_overall, google_review_count, instagram_followers_count,
    menu_pdf_name, enriched_at, enrichment_sources, zone, city,
    facebook_followers,
    google_reviews, menus, popular_times, products,
    google_name, mesita_name,
    reservation_channel, reservation_target,
    business_state, business_state_at,
    name_embedding, name_embedding_hash,
    google_address, source_sync
  ) values (
    coalesce(new.id, gen_random_uuid()), coalesce(new.created_at, now()),
    coalesce(new.updated_at, now()), new.google_place_id, new.category,
    new.category_label, new.price_level, new.lat, new.lng, new.address,
    new.timezone, new.closes_at, new.phone, new.pitch, new.story,
    coalesce(new.photos, '{}'), new.website_url, new.instagram_url,
    new.facebook_url, new.whatsapp_url, new.opentable_url, new.resy_url,
    new.uber_eats_url, new.x_url, new.threads_url, new.reddit_url,
    new.google_maps_url, new.didi_food_url,
    new.hours, new.embedding, new.embedding_source_hash, new.embedding_source_text,
    new.description, new.menu_pdf_url, coalesce(new.tags, '{}'),
    new.google_stars_overall, new.google_review_count, new.instagram_followers_count,
    new.menu_pdf_name, new.enriched_at, new.enrichment_sources,
    new.zone, new.city,
    new.facebook_followers,
    new.google_reviews, new.menus, new.popular_times, new.products,
    new.google_name,
    coalesce(new.mesita_name, new.name),
    new.reservation_channel, new.reservation_target,
    new.business_state, new.business_state_at,
    new.name_embedding, new.name_embedding_hash,
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
    google_place_id = new.google_place_id, category = new.category,
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
    embedding = new.embedding, embedding_source_hash = new.embedding_source_hash,
    embedding_source_text = new.embedding_source_text,
    name_embedding = new.name_embedding,
    name_embedding_hash = new.name_embedding_hash,
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
    mesita_name = new.mesita_name,
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

drop view if exists public.profiles;
create view public.profiles with (security_invoker = true) as
 SELECT p.id,
    p.created_at,
    p.updated_at,
    p.google_place_id,
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
    p.embedding_source_hash,
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
    p.mesita_name,
    p.reservation_channel,
    p.reservation_target,
    p.business_state,
    p.business_state_at,
    p.name_embedding,
    p.name_embedding_hash,
    p.request_count,
    public.families_for_category(p.category) as family_keys,
    p.reservations_enabled,
    p.google_address,
    p.source_sync
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

-- A category may sit in any number of families. Undefined still only alone.
-- Same function OID, so both CHECK constraints follow this body.
create or replace function public.atlas_family_slugs_valid(slugs text[])
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    slugs is not null
    and (select count(distinct x) from unnest(slugs) as x) = cardinality(slugs)
    and not ('undefined' = any(slugs) and cardinality(slugs) > 1)
    and not exists (
      select 1
      from unnest(slugs) as s
      where not exists (
        select 1 from public.place_families p
        where p.slug = s
      )
    );
$$;

comment on function public.atlas_family_slugs_valid(text[]) is
  'Family arrays: unique slugs from public.place_families, any count; undefined only alone. A category may sit in many families.';

do $postflight$
begin
  if pg_get_viewdef('public.profiles'::regclass) not like '%families_for_category%' then
    raise exception 'profiles.family_keys is not derived from the category mapping';
  end if;
  if not exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'profiles'
       and coalesce(c.reloptions, '{}') @> array['security_invoker=true']
  ) then
    raise exception 'profiles lost security_invoker';
  end if;
  if pg_get_functiondef('public.profiles_update'::regproc) like '%family_keys = new.family_keys%' then
    raise exception 'profiles_update still copies family_keys onto the place';
  end if;
  if pg_get_functiondef('public.atlas_family_slugs_valid(text[])'::regprocedure)
     like '%cardinality(slugs) <= 2%' then
    raise exception 'atlas_family_slugs_valid still caps a category at two families';
  end if;
end
$postflight$;
