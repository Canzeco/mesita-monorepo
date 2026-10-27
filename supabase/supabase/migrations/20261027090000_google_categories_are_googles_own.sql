-- MESITA-2836: the profile field model. Pato, 2026-10-26: "Google Name /
-- Google Categories / Google Price (not editable, canonic) computed with
-- Details step (however, the categories are the same,) … Mesita Name /
-- Presentation / Tags (editable, inferred with llm based on all profile)
-- computed with Description step."
--
-- The Google categories ARE Google's own types: google_types is derived from
-- google_source_types (Google's list as last fetched, primary first, Table B
-- dropped) kept to the canonical catalog — no model picks a subset and no
-- cap of three (MESITA-2827's categories call goes; its families half went
-- with MESITA-2834). Create, Google Update and the Enricher's Details step
-- write google_source_types; this trigger writes google_types and the shown
-- category from it, so the three can never disagree.

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

-- Every stored place: its categories become Google's own list, once.
update public.place_profiles p
   set google_types = d.types
  from (
    select p2.id,
           (select coalesce(jsonb_agg(t.slug order by t.ord), '[]'::jsonb)
              from jsonb_array_elements_text(p2.google_source_types) with ordinality as t(slug, ord)
             where exists (select 1 from public.catalog_membership c where c.slug = t.slug)) as types
      from public.place_profiles p2
     where jsonb_typeof(p2.google_source_types) = 'array'
       and jsonb_array_length(p2.google_source_types) > 0
  ) d
 where d.id = p.id
   and jsonb_array_length(d.types) > 0
   and p.google_types is distinct from d.types;

comment on column public.place_profiles.google_types is
  'MESITA-2836: the Google categories — Google''s own types (google_source_types) kept to catalog_membership, primary first, derived by place_profiles_taxonomy(); the first is the shown category. Never edited, never model-picked.';
comment on column public.place_profiles.google_source_types is
  'Google''s own types as last fetched (primary first, Table B dropped), written by Create, Google Update and the Enricher''s Details step; google_types derives from it (MESITA-2836).';
