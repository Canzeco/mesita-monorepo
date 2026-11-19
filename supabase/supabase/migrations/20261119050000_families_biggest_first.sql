-- MESITA-4430: the biggest families open the row.
--
-- Pato, 2026-11-18, on the Home category row: "add like bigger families at
-- the beggining … Dinner. Coffee. Bar. Quick. Breakfast … like a better
-- order". The day arc (Coffee → Tourism) opened on Bakery and Dessert, one
-- and two places, while Mexican, Dinner, Quick and Bar sat far right. Now:
-- Dinner, Coffee, Bar, Quick, Breakfast, then by live place count, the
-- families no place carries yet last. Slugs, labels and emoji untouched.
-- seed_place_families() is redefined (the parity test reads the newest
-- migration's seed) and run once.

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
    ('chinese', 'Chinese', '🥡', 21),
    ('indian', 'Indian', '🍛', 22),
    ('chicken', 'Wings', '🍗', 23),
    ('sweet', 'Dessert', '🍰', 24),
    ('night_out', 'Night', '🌙', 25),
    ('bakery', 'Bakery', '🥐', 26),
    ('nightclub', 'Club', '🪩', 27),
    ('music', 'Music', '🎶', 28),
    ('family', 'Family', '👨‍👩‍👧', 29),
    ('sports', 'Sports', '📺', 30),
    ('hookah', 'Hookah', '💨', 31),
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
   where slug not in ('dinner','coffee','drinks','quick_bite','breakfast','mexican','tacos','seafood','asian','european','fancy','steak','japanese','american','healthy','italian','sushi','pizza','burgers','arabic','chinese','indian','chicken','sweet','night_out','bakery','nightclub','music','family','sports','hookah','karaoke','fun','cinema','casino','spa','tourist','undefined');
end;
$function$;

select public.seed_place_families();
