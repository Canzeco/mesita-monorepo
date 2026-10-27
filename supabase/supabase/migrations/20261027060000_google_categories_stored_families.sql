-- MESITA-2827 (parent MESITA-2826): Google categories and Families are two
-- independent lists, both inferred by a model on Create and every Enrich.
--
-- Pato, 2026-10-26: "Google categories: hasta tres categorías de la lista
-- canónica de Google … Inesita families: hasta cinco … lista independiente de
-- Google categories, editable directamente e inferida con un modelo … Las
-- categorías de Google pueden sugerir familias, pero editar las categorías no
-- debe sobrescribirlas." This reverses MESITA-2790's "families are never
-- inferred by an LLM".
--
-- * google_types: 1–3 catalog_membership slugs, first = shown = category.
-- * place_profiles.family_keys: 1–5 place_families slugs, stored. Until a
--   list is stored the view maps the Google categories to families.
-- * google_source_types: Google's own types as last fetched (primary first,
--   Table B dropped), the model's input. Written by Create and Google Update.
-- * mesita_categories is no longer written or read; its drop is a follow-up.

alter table public.place_profiles
  add column if not exists google_source_types jsonb not null default '[]'::jsonb;

-- Until now google_types WAS Google's own list.
update public.place_profiles
   set google_source_types = google_types
 where jsonb_typeof(google_types) = 'array'
   and google_source_types = '[]'::jsonb;

comment on column public.place_profiles.google_source_types is
  'MESITA-2827: Google''s own types as last fetched (primary first, Table B dropped). Input to the Google categories model; never shown.';

-- ── Taxonomy trigger ────────────────────────────────────────────────────
-- Checked on insert and when a list changes, so a legacy row with more than
-- three raw Google types stays writable until an Enrich replaces its list.
create or replace function public.place_profiles_taxonomy()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_types jsonb := case when jsonb_typeof(new.google_types) = 'array'
                        then new.google_types else '[]'::jsonb end;
begin
  if tg_op = 'INSERT' or new.google_types is distinct from old.google_types then
    if tg_op = 'UPDATE' then
      if jsonb_array_length(v_types) > 3 then
        raise exception 'at most three google categories';
      end if;
      if exists (
        select 1 from jsonb_array_elements_text(v_types) as t(slug)
         where not exists (select 1 from public.catalog_membership c where c.slug = t.slug)
      ) then
        raise exception 'unknown google category';
      end if;
    end if;
    -- The shown category is the first Google category.
    if jsonb_array_length(v_types) > 0
       and exists (select 1 from public.catalog_membership c where c.slug = v_types ->> 0) then
      new.category := v_types ->> 0;
      new.category_label := upper(left(replace(v_types ->> 0, '_', ' '), 1)) || substr(replace(v_types ->> 0, '_', ' '), 2);
    end if;
  end if;
  if new.category is null or btrim(new.category) = '' then
    new.category := 'undefined';
  end if;
  if tg_op = 'INSERT' or new.category is distinct from old.category then
    if not exists (select 1 from public.catalog_membership c where c.slug = new.category)
       and not exists (select 1 from public.place_categories c where c.slug = new.category)
    then
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
  if new.family_keys is not null and cardinality(new.family_keys) = 0 then
    new.family_keys := null;
  end if;
  if tg_op = 'INSERT' or new.family_keys is distinct from old.family_keys then
    if cardinality(new.family_keys) > 5 then
      raise exception 'at most five families';
    end if;
    if exists (
      select 1 from unnest(coalesce(new.family_keys, '{}'::text[])) as f(slug)
       where f.slug = 'undefined'
          or not exists (select 1 from public.place_families pf where pf.slug = f.slug)
    ) then
      raise exception 'unknown family';
    end if;
  end if;
  return new;
end;
$function$;

-- ── Families of a place: stored, else mapped from its Google categories ──
create or replace function public.place_family_keys(stored text[], google_types jsonb, fallback text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when cardinality(stored) > 0 then
      (select array_agg(s.key order by f.sort_order nulls last, s.key)
         from unnest(stored) as s(key)
         left join public.place_families f on f.slug = s.key)
    else public.families_for_categories(google_types, fallback)
  end;
$$;

comment on function public.place_family_keys(text[], jsonb, text) is
  'MESITA-2827: profiles.family_keys. The stored list (1–5, inferred on Create and every Enrich, editable) in place_families.sort_order; with none stored, families_for_categories(google_types, category), the Google→family map.';

grant execute on function public.place_family_keys(text[], jsonb, text) to anon, authenticated, service_role;

comment on column public.place_profiles.family_keys is
  'MESITA-2827: Families, 1–5 place_families slugs, inferred by a model on Create and every Enrich, independent of google_types. NULL = not inferred yet; the profiles view then maps the Google categories.';
comment on column public.place_profiles.google_types is
  'MESITA-2827: Google categories, 1–3 catalog_membership slugs chosen by a model from Google''s own types on Create and every Enrich; the first is the shown category.';
comment on column public.place_profiles.mesita_categories is
  'Retired by MESITA-2827: no longer written or read. Dropped in a follow-up.';

-- ── The view reads it ───────────────────────────────────────────────────
-- Same columns, same types: replace keeps grants and the INSTEAD OF triggers.
create or replace view public.profiles with (security_invoker = true) as
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
    p.mesita_name,
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

-- ── Existing rows: the shown category is the first Google category ─────
update public.place_profiles p
   set category = p.google_types ->> 0,
       category_label = upper(left(replace(p.google_types ->> 0, '_', ' '), 1)) || substr(replace(p.google_types ->> 0, '_', ' '), 2)
 where jsonb_typeof(p.google_types) = 'array'
   and jsonb_array_length(p.google_types) > 0
   and p.category is distinct from p.google_types ->> 0
   and exists (select 1 from public.catalog_membership c where c.slug = p.google_types ->> 0);

do $postflight$
begin
  if pg_get_viewdef('public.profiles'::regclass) not like '%place_family_keys%' then
    raise exception 'profiles.family_keys does not read the stored families (MESITA-2827)';
  end if;
  if pg_get_functiondef('public.place_profiles_taxonomy'::regproc) not like '%at most five families%' then
    raise exception 'the taxonomy trigger still discards stored families';
  end if;
end
$postflight$;
