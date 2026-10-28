-- MESITA-2930: thirty-seven families. Beer, Cocktails and Wine fold into Bar.
--
-- Pato, 2026-10-27, on the Search Filters sheet: "why the fuck do we still
-- have cocketails and that shit" → "Fold Beer, Cocktails and Wine into Bar.
-- Keep Sports and Hookah. Ship it."
--
-- `drinks` (label Bar) absorbs `beer`, `cocktails` and `wine`: their Google
-- types (brewery, beer_garden, pub, cocktail_bar, lounge_bar, wine_bar,
-- winery, vineyard, the German and Czech restaurants) now map to Bar in the
-- code's Discovery map. sort_order closes up, 1..37, Undefined stays 999.
--
-- Order:
--   1. seed_place_families() is defined FIRST (place-families-parity.test.ts
--      reads the first `insert into public.place_families` in the newest
--      migration that defines the seed).
--   2. Every stored place_profiles.family_keys swaps the three for `drinks`,
--      deduped, in catalog order (MESITA-2891 stores the model's 1–5 pick;
--      a fold only shrinks a list, so the cap holds). This runs before the
--      seed deletes the rows, so nothing stored names a dead family.
--   3. The seed runs: +1000 shift, the 37 + Undefined upserted at 1..37 and
--      999 (no collision with 1001..1040), the three rows deleted.
--   4. The two stored Name switch sets are rebuilt from place_families, as
--      MESITA-2892 did: a surviving key keeps its value, the three go.
-- catalog_membership and place_categories carry no families since MESITA-2891.

create or replace function public.seed_place_families()
returns void
language plpgsql
set search_path to ''
as $function$
begin
  update public.place_families set sort_order = sort_order + 1000 where true;
  insert into public.place_families (slug, label, emoji, sort_order) values
    ('coffee', 'Coffee', '☕', 1),
    ('breakfast', 'Breakfast', '🍳', 2),
    ('bakery', 'Bakery', '🥐', 3),
    ('sweet', 'Dessert', '🍰', 4),
    ('healthy', 'Healthy', '🥗', 5),
    ('quick_bite', 'Quick', '⚡', 6),
    ('tacos', 'Tacos', '🌮', 7),
    ('burgers', 'Burgers', '🍔', 8),
    ('pizza', 'Pizza', '🍕', 9),
    ('chicken', 'Wings', '🍗', 10),
    ('sushi', 'Sushi', '🍣', 11),
    ('mexican', 'Mexican', '🌶️', 12),
    ('steak', 'Steak', '🥩', 13),
    ('seafood', 'Seafood', '🦐', 14),
    ('italian', 'Italian', '🍝', 15),
    ('japanese', 'Japanese', '🍱', 16),
    ('chinese', 'Chinese', '🥡', 17),
    ('asian', 'Asian', '🍥', 18),
    ('indian', 'Indian', '🍛', 19),
    ('arabic', 'Arabic', '🧆', 20),
    ('european', 'European', '🥨', 21),
    ('american', 'American', '🍟', 22),
    ('dinner', 'Dinner', '🍽️', 23),
    ('fancy', 'Fancy', '🥂', 24),
    ('family', 'Family', '👨‍👩‍👧', 25),
    ('drinks', 'Bar', '🍻', 26),
    ('sports', 'Sports', '📺', 27),
    ('hookah', 'Hookah', '💨', 28),
    ('night_out', 'Night', '🌙', 29),
    ('nightclub', 'Club', '🪩', 30),
    ('music', 'Music', '🎶', 31),
    ('karaoke', 'Karaoke', '🎤', 32),
    ('fun', 'Fun', '🎯', 33),
    ('cinema', 'Cinema', '🎬', 34),
    ('casino', 'Casino', '🎰', 35),
    ('spa', 'Spa', '🧖', 36),
    ('tourist', 'Tourist', '🏛️', 37),
    ('undefined', 'Undefined', '·', 999)
  on conflict (slug) do update set
    label = excluded.label,
    emoji = excluded.emoji,
    sort_order = excluded.sort_order;
  delete from public.place_families
   where slug not in ('coffee','breakfast','bakery','sweet','healthy','quick_bite','tacos','burgers','pizza','chicken','sushi','mexican','steak','seafood','italian','japanese','chinese','asian','indian','arabic','european','american','dinner','fancy','family','drinks','sports','hookah','night_out','nightclub','music','karaoke','fun','cinema','casino','spa','tourist','undefined');
end;
$function$;

update public.place_profiles p
   set family_keys = (
     select array_agg(x.k order by f.sort_order)
       from (select distinct case when k in ('beer', 'cocktails', 'wine') then 'drinks' else k end as k
               from unnest(p.family_keys) as k) x
       join public.place_families f on f.slug = x.k)
 where p.family_keys && array['beer', 'cocktails', 'wine']::text[];

select public.seed_place_families();

do $$
declare
  path text[];
begin
  foreach path slice 1 in array array[array['name','fast','supers'], array['name','deep','supers']]
  loop
    update public.app_config c
       set discovery_config = jsonb_set(
             c.discovery_config,
             path,
             (select coalesce(jsonb_object_agg(f.slug,
                       coalesce(c.discovery_config #> (path || f.slug), 'false'::jsonb)
                     order by f.sort_order), '{}'::jsonb)
                from public.place_families f
               where f.slug <> 'undefined'))
     where c.discovery_config #> path is not null;
  end loop;
end;
$$;

-- Postflight.
do $$
declare
  n int;
begin
  select count(*) into n from public.place_families;
  if n <> 38 then
    raise exception 'place_families holds % rows, expected 37 families plus Undefined', n;
  end if;
  select count(*) into n from public.place_profiles
   where family_keys && array['beer', 'cocktails', 'wine']::text[];
  if n <> 0 then
    raise exception '% places still store Beer, Cocktails or Wine', n;
  end if;
  select count(*) into n
    from public.app_config c,
         lateral (values (c.discovery_config #> '{name,fast,supers}'),
                         (c.discovery_config #> '{name,deep,supers}')) v(obj),
         lateral jsonb_object_keys(coalesce(v.obj, '{}'::jsonb)) k
   where k not in (select slug from public.place_families);
  if n <> 0 then
    raise exception '% stored discovery switches still name a family that is gone', n;
  end if;
end;
$$;
