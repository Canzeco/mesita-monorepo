-- MESITA-3087: a place carries up to seven Mesita Families, not five.
--
-- Pato, 2026-10-29: "Enable to select max 7 families instead of 5".
-- The trigger's literal moves with ENRICH_FIELD_LIMITS.familiesPerPlace.max
-- (_shared/enrich-field-limits.ts); the body is otherwise the one
-- 20261027090000_google_categories_are_googles_own.sql defined. A raised cap
-- only widens what is allowed, so no stored list changes.

create or replace function public.place_profiles_taxonomy()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_types jsonb;
begin
  -- Details: Google's own types become the Google categories (MESITA-2836).
  if tg_op = 'INSERT' or new.google_source_types is distinct from old.google_source_types then
    if jsonb_typeof(new.google_source_types) = 'array'
       and jsonb_array_length(new.google_source_types) > 0 then
      select coalesce(jsonb_agg(t.slug order by t.ord), '[]'::jsonb) into v_types
        from jsonb_array_elements_text(new.google_source_types) with ordinality as t(slug, ord)
       where exists (select 1 from public.catalog_membership c where c.slug = t.slug);
      if jsonb_array_length(v_types) > 0 then
        new.google_types := v_types;
      end if;
    end if;
  end if;
  v_types := case when jsonb_typeof(new.google_types) = 'array'
                  then new.google_types else '[]'::jsonb end;
  if tg_op = 'INSERT' or new.google_types is distinct from old.google_types then
    if tg_op = 'UPDATE' then
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
    if cardinality(new.family_keys) > 7 then
      raise exception 'at most seven families';
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

comment on column public.place_profiles.family_keys is
  'MESITA-2891: Mesita Families, 1–7 of the live place_families (1–5 until MESITA-3087), inferred by the Description step''s model on Create and every Enrich, or set on Basics. Null = Undefined.';
