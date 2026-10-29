-- MESITA-3036: the Tourist family reads Tourism.
--
-- Pato, 2026-10-28: "change the name of one family from tourist to Tourism".
-- Only the label moves; the slug `tourist` stays, because stored keys
-- (place_profiles.family_keys, the Name switch sets) name it.
-- seed_place_families() is redefined with the new label (the parity test
-- reads the newest migration's seed) and run once.

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
    ('tourist', 'Tourism', '🏛️', 37),
    ('undefined', 'Undefined', '·', 999)
  on conflict (slug) do update set
    label = excluded.label,
    emoji = excluded.emoji,
    sort_order = excluded.sort_order;
  delete from public.place_families
   where slug not in ('coffee','breakfast','bakery','sweet','healthy','quick_bite','tacos','burgers','pizza','chicken','sushi','mexican','steak','seafood','italian','japanese','chinese','asian','indian','arabic','european','american','dinner','fancy','family','drinks','sports','hookah','night_out','nightclub','music','karaoke','fun','cinema','casino','spa','tourist','undefined');
end;
$function$;

select public.seed_place_families();
