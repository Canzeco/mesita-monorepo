-- MESITA-2790: families come from the Mesita categories; google_types is the
-- Google categories list with the primary first.
--
-- Pato, 2026-10-26: "Families cannot be directly inferred by LLMs never. You
-- can save the categories and then the categories map to the families."
-- mesita_categories (1–3 place_categories slugs, main first) is now inferred
-- on Create and on every Enrich; profiles.family_keys is their union. A place
-- with no Mesita categories yet keeps today's value: its category's families.

-- ── Families of a list of categories ────────────────────────────────────
-- Union of families_for_category() over the slugs, in category order then
-- each category's own order, first occurrence kept. `undefined` is dropped
-- unless it is all there is. An empty list answers for `fallback`.
create or replace function public.families_for_categories(cats jsonb, fallback text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  with slugs as (
    select e.slug, e.ord
      from jsonb_array_elements_text(
             case when jsonb_typeof(cats) = 'array' then cats else '[]'::jsonb end
           ) with ordinality as e(slug, ord)
  ),
  keys as (
    select k.key, min(s.ord * 1000 + k.kord) as pos
      from slugs s
      cross join lateral unnest(public.families_for_category(s.slug))
             with ordinality as k(key, kord)
     group by k.key
  )
  select case
    when not exists (select 1 from slugs) then public.families_for_category(fallback)
    when exists (select 1 from keys where key <> 'undefined')
      then (select array_agg(key order by pos) from keys where key <> 'undefined')
    else array['undefined']::text[]
  end;
$$;

comment on function public.families_for_categories(jsonb, text) is
  'MESITA-2790: profiles.family_keys. Union of families_for_category over the Mesita categories (category order, then each category''s own order), undefined dropped unless alone; empty list → families_for_category(fallback). Never an LLM.';

grant execute on function public.families_for_categories(jsonb, text) to anon, authenticated, service_role;

-- ── The view reads it ───────────────────────────────────────────────────
-- Append-only: replace keeps grants and the INSTEAD OF triggers.
create or replace view public.profiles with (security_invoker = true) as
 SELECT p.id,
    p.created_at,
    p.updated_at,
    p.google_place_id,
    p.google_primary_type,
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
    p.google_photos,
    p.mesita_photos,
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
    public.families_for_categories(p.mesita_categories, p.category) as family_keys,
    p.reservations_enabled,
    p.google_address,
    p.source_sync,
    u.selected,
    p.google_tags,
    u.boost_tier
   FROM places u
     JOIN place_profiles p ON p.id = u.id;

-- ── Mesita categories are known place_categories slugs ──────────────────
-- Checked on insert and when the list changes, so a legacy row holding a
-- Google slug stays writable until an Enrich replaces its list.
create or replace function public.place_profiles_taxonomy()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
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
  if tg_op = 'INSERT' or new.mesita_categories is distinct from old.mesita_categories then
    if exists (
      select 1
        from jsonb_array_elements_text(
               case when jsonb_typeof(new.mesita_categories) = 'array'
                    then new.mesita_categories else '[]'::jsonb end
             ) as m(slug)
       where m.slug = 'undefined'
          or not exists (select 1 from public.place_categories pc where pc.slug = m.slug)
    ) then
      raise exception 'unknown mesita category';
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
$function$;

comment on column public.place_profiles.mesita_categories is
  'MESITA-2790: Mesita categories, 1–3 place_categories slugs, main first, inferred on Create and every Enrich; read-only to operators. category = the first. profiles.family_keys derives from them.';

-- ── google_types: Google's primary first ────────────────────────────────
-- google_primary_type is a mirror of google_types[0] until MESITA-2791 drops
-- it. Only a real Google type leads: an older backfill copied the Mesita
-- category into google_primary_type, so the value must be a catalog_membership
-- slug (the Table A set).
update public.place_profiles p
   set google_types = jsonb_build_array(p.google_primary_type) || coalesce(
         (select jsonb_agg(t.value order by t.ord)
            from jsonb_array_elements(coalesce(p.google_types, '[]'::jsonb))
                 with ordinality as t(value, ord)
           where t.value <> to_jsonb(p.google_primary_type)),
         '[]'::jsonb)
 where p.google_primary_type is not null
   and exists (select 1 from public.catalog_membership c where c.slug = p.google_primary_type)
   and coalesce(p.google_types ->> 0, '') <> p.google_primary_type;
