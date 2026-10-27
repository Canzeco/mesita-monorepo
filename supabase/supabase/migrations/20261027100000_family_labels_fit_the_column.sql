-- MESITA-2841: six family labels that fit Home's column. Pato, 2026-10-26,
-- on the phone emulator: "rename sandiwshes to sandish to make word
-- shorter", then "try to same for very large families". Nine letters is the
-- widest label the column draws on one line, so every label over eight
-- shortens (Breakfast, nine, fits): Sandwiches → Sandwich, Mediterranean →
-- Greek, Cocktails → Cocktail, Dumplings → Dumpling, Nightclub → Club,
-- Nightlife → Night. Slugs and the dictionary do not move (stored keys never
-- follow a label, MESITA-2760). The seed is redefined whole, as always, so
-- place-families-parity.test.ts reads these rows from the newest seed.

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
    ('brunch', 'Brunch', '🥞', 3),
    ('bakery', 'Bakery', '🥐', 4),
    ('sweet', 'Dessert', '🍰', 5),
    ('gelato', 'Gelato', '🍦', 6),
    ('healthy', 'Healthy', '🥗', 7),
    ('vegan', 'Vegan', '🌱', 8),
    ('quick_bite', 'Quick', '⚡', 9),
    ('tacos', 'Tacos', '🌮', 10),
    ('burgers', 'Burgers', '🍔', 11),
    ('pizza', 'Pizza', '🍕', 12),
    ('sandwiches', 'Sandwich', '🥪', 13),
    ('chicken', 'Chicken', '🍗', 14),
    ('wings', 'Wings', '🔥', 15),
    ('kebab', 'Kebab', '🥙', 16),
    ('dinner', 'Dinner', '🍽️', 17),
    ('mexican', 'Mexican', '🌶️', 18),
    ('steak', 'Steak', '🥩', 19),
    ('bbq', 'BBQ', '🍖', 20),
    ('seafood', 'Seafood', '🦐', 21),
    ('italian', 'Italian', '🍝', 22),
    ('sushi', 'Sushi', '🍣', 23),
    ('japanese', 'Japanese', '🍱', 24),
    ('ramen', 'Ramen', '🍜', 25),
    ('noodles', 'Noodles', '🥢', 26),
    ('chinese', 'Chinese', '🥡', 27),
    ('dumplings', 'Dumpling', '🥟', 28),
    ('korean', 'Korean', '🍚', 29),
    ('thai', 'Thai', '🍲', 30),
    ('indian', 'Indian', '🍛', 31),
    ('asian', 'Asian', '🍥', 32),
    ('arabic', 'Arabic', '🧆', 33),
    ('mediterranean', 'Greek', '🫒', 34),
    ('spanish', 'Spanish', '🥘', 35),
    ('french', 'French', '🥖', 36),
    ('european', 'European', '🥨', 37),
    ('american', 'American', '🍟', 38),
    ('latin', 'Latin', '🌎', 39),
    ('fancy', 'Fancy', '🥂', 40),
    ('drinks', 'Bar', '🍻', 41),
    ('beer', 'Beer', '🍺', 42),
    ('cocktails', 'Cocktail', '🍸', 43),
    ('wine', 'Wine', '🍷', 44),
    ('sports', 'Sports', '📺', 45),
    ('hookah', 'Hookah', '💨', 46),
    ('night_out', 'Night', '🌙', 47),
    ('nightclub', 'Club', '🪩', 48),
    ('music', 'Music', '🎶', 49),
    ('karaoke', 'Karaoke', '🎤', 50),
    ('undefined', 'Undefined', '·', 999)
  on conflict (slug) do update set
    label = excluded.label,
    emoji = excluded.emoji,
    sort_order = excluded.sort_order;
  delete from public.place_families
   where slug not in ('coffee','breakfast','brunch','bakery','sweet','gelato','healthy','vegan','quick_bite','tacos','burgers','pizza','sandwiches','chicken','wings','kebab','dinner','mexican','steak','bbq','seafood','italian','sushi','japanese','ramen','noodles','chinese','dumplings','korean','thai','indian','asian','arabic','mediterranean','spanish','french','european','american','latin','fancy','drinks','beer','cocktails','wine','sports','hookah','night_out','nightclub','music','karaoke','undefined');
end;
$function$;

select public.seed_place_families();
