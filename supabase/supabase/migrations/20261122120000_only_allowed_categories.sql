-- MESITA-4576: the database keeps only what Mesita allows.
--
-- Pato, 2026-11-21, after MESITA-4571 cut the allowed Google categories to
-- 160: "okey, clean db. i don't want not allowed sht".
--
--   1. place_profiles.google_types drops every Google category with no
--      enabled catalog_membership row. No place has one first, so no shown
--      category changes; 45 places lose extras like store or event_venue.
--      google_source_types (Google's raw answer) is untouched: it is input,
--      and the taxonomy trigger re-filters it on the next Details step.
--   2. catalog_membership becomes the allow-list: every switched-off row
--      (318 on 2026-11-21) is deleted, and a CHECK keeps one from coming
--      back. Every reader already treats a missing row as not allowed;
--      Google's full type list stays in code (GOOGLE_TYPE_SUPER).
--   3. place_categories keeps only `undefined`, the one slug the taxonomy
--      trigger still needs, and seed_place_categories() seeds only it, so
--      an admin Reset does not restore the 100 legacy Mesita slugs.
-- The taxonomy trigger refuses an unknown Google category on UPDATE; step 1
-- writes only allowed ones, so it passes.

update public.place_profiles p
   set google_types = (
     select coalesce(jsonb_agg(t.slug order by t.ord), '[]'::jsonb)
       from jsonb_array_elements_text(p.google_types) with ordinality as t(slug, ord)
      where exists (select 1 from public.catalog_membership m where m.slug = t.slug and m.enabled))
 where jsonb_typeof(p.google_types) = 'array'
   and exists (
     select 1 from jsonb_array_elements_text(p.google_types) as t(slug)
      where not exists (select 1 from public.catalog_membership m where m.slug = t.slug and m.enabled));

delete from public.catalog_membership where not enabled;

alter table public.catalog_membership
  add constraint catalog_membership_allowed_only check (enabled);

create or replace function public.seed_place_categories()
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.place_categories (slug, label, section, sort_order) values
    ('undefined', '❓ Undefined', 'Food & Nightlife', 999)
  on conflict (slug) do update set
    label      = excluded.label,
    section    = excluded.section,
    sort_order = excluded.sort_order;
  delete from public.place_categories where slug <> 'undefined';
end;
$$;

select public.seed_place_categories();

-- Postflight.
do $$
declare
  n int;
begin
  select count(*) into n from public.catalog_membership where not enabled;
  if n <> 0 then
    raise exception '% switched-off Google categories are still stored', n;
  end if;
  select count(*) into n from public.catalog_membership;
  if n < 150 then
    raise exception 'catalog_membership holds % rows, expected the ~160 allowed', n;
  end if;
  select count(*) into n from public.place_categories where slug <> 'undefined';
  if n <> 0 then
    raise exception '% legacy place_categories rows remain', n;
  end if;
  select count(*) into n
    from public.place_profiles p, jsonb_array_elements_text(
           case when jsonb_typeof(p.google_types) = 'array' then p.google_types else '[]'::jsonb end) as t(slug)
   where not exists (select 1 from public.catalog_membership m where m.slug = t.slug);
  if n <> 0 then
    raise exception '% stored Google categories are not allowed', n;
  end if;
  select count(*) into n from public.place_profiles p
    left join public.catalog_membership m on m.slug = p.category
   where m.slug is null and p.category <> 'undefined';
  if n <> 0 then
    raise exception '% places show a category that is not allowed', n;
  end if;
end;
$$;
