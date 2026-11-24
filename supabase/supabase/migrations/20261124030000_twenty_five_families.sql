-- MESITA-4818: twenty-five families.
--
-- Pato, 2026-11-23: "Think deeply. Compress list into 25 families". Live
-- counts on 265 places picked the five thinnest rails, each with a parent a
-- guest already browses:
--
--   Club (nightclub, 3 places)  → Night (night_out)
--   Music (music, 1)            → Night (night_out)
--   Chinese (chinese, 3)        → Asian (asian)
--   Indian (indian, 3)          → Asian (asian)
--   Bakery (bakery, 1)          → Dessert (sweet)
--
-- Slugs, labels and emoji of the other 25 are untouched; only sort_order
-- closes up. No Google category goes off: catalog_membership is untouched,
-- the code map (catalog-families.ts) sends each type to the parent.
--
--   1. seed_place_families() first (place-families-parity.test.ts reads the
--      newest migration's seed).
--   2. Stored lists re-key the folded slug to its parent, keeping the place
--      of the first of the two and never a duplicate.
--   3. The seed runs.

create or replace function public.seed_place_families()
returns void
language plpgsql
set search_path to ''
as $function$
begin
  update public.place_families set sort_order = sort_order + 1000 where true;
  insert into public.place_families (slug, label, emoji, sort_order) values
    ('dinner', 'Dinner', '🍽️', 1),
    ('coffee', 'Coffee', '☕', 2),
    ('drinks', 'Bar', '🍻', 3),
    ('quick_bite', 'Quick', '⚡', 4),
    ('breakfast', 'Breakfast', '🍳', 5),
    ('mexican', 'Mexican', '🇲🇽', 6),
    ('tacos', 'Tacos', '🌮', 7),
    ('seafood', 'Seafood', '🦐', 8),
    ('asian', 'Asian', '🍥', 9),
    ('european', 'European', '🥨', 10),
    ('fancy', 'Fancy', '🥂', 11),
    ('steak', 'Steak', '🥩', 12),
    ('japanese', 'Japanese', '🍱', 13),
    ('american', 'American', '🍟', 14),
    ('healthy', 'Healthy', '🥗', 15),
    ('italian', 'Italian', '🍝', 16),
    ('sushi', 'Sushi', '🍣', 17),
    ('pizza', 'Pizza', '🍕', 18),
    ('burgers', 'Burgers', '🍔', 19),
    ('arabic', 'Arabic', '🧆', 20),
    ('chicken', 'Wings', '🍗', 21),
    ('sweet', 'Dessert', '🍰', 22),
    ('night_out', 'Night', '🌙', 23),
    ('fun', 'Fun', '🎯', 24),
    ('casino', 'Casino', '🎰', 25),
    ('undefined', 'Undefined', '·', 999)
  on conflict (slug) do update set
    label = excluded.label,
    emoji = excluded.emoji,
    sort_order = excluded.sort_order;
  delete from public.place_families
   where slug not in ('dinner','coffee','drinks','quick_bite','breakfast','mexican','tacos','seafood','asian','european','fancy','steak','japanese','american','healthy','italian','sushi','pizza','burgers','arabic','chicken','sweet','night_out','fun','casino','undefined');
end;
$function$;

update public.place_profiles p
   set family_keys = (
     select array_agg(f.slug order by f.ord)
       from (
         select m.slug, min(k.ord) as ord
           from unnest(p.family_keys) with ordinality as k(slug, ord)
          cross join lateral (
            select case k.slug
                     when 'nightclub' then 'night_out'
                     when 'music' then 'night_out'
                     when 'chinese' then 'asian'
                     when 'indian' then 'asian'
                     when 'bakery' then 'sweet'
                     else k.slug
                   end as slug
          ) m
          group by m.slug
       ) f)
 where p.family_keys && array['nightclub', 'music', 'chinese', 'indian', 'bakery']::text[];

select public.seed_place_families();

-- Postflight.
do $$
declare
  n int;
begin
  select count(*) into n from public.place_families;
  if n <> 26 then
    raise exception 'place_families holds % rows, expected 25 families plus Undefined', n;
  end if;
  select count(*) into n from public.place_families
   where slug in ('nightclub', 'music', 'chinese', 'indian', 'bakery');
  if n <> 0 then
    raise exception 'a folded family is still a family';
  end if;
  select count(*) into n from public.place_profiles
   where family_keys && array['nightclub', 'music', 'chinese', 'indian', 'bakery']::text[];
  if n <> 0 then
    raise exception '% places still store a folded family', n;
  end if;
  select count(*) into n from public.place_profiles
   where family_keys is not null
     and cardinality(family_keys) <> (select count(distinct x) from unnest(family_keys) x);
  if n <> 0 then
    raise exception '% places store a family twice', n;
  end if;
end;
$$;
