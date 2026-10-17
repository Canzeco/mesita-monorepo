-- One emoji per guest family. Undefined stays a dot and is not a carousel.
-- The consumer feed and the admin console both read this mark.

create or replace function public.seed_place_families()
returns void
language plpgsql
set search_path to ''
as $function$
begin
  update public.place_families set sort_order = sort_order + 1000 where true;
  insert into public.place_families (slug, label, emoji, sort_order) values
    ('coffee', 'Coffee', '☕', 1),
    ('breakfast', 'Breakfast', '🥐', 2),
    ('quick_bite', 'Quick bite', '🥙', 3),
    ('pizza', 'Pizza', '🍕', 4),
    ('tacos', 'Tacos', '🌮', 5),
    ('sushi', 'Sushi', '🍣', 6),
    ('burgers', 'Burgers', '🍔', 7),
    ('noodles', 'Noodles', '🍜', 8),
    ('dinner', 'Dinner', '🍽️', 9),
    ('sweet', 'Sweet', '🍰', 10),
    ('drinks', 'Drinks', '🍸', 11),
    ('night_out', 'Night out', '🌙', 12),
    ('go_out', 'Go out', '🎟️', 13),
    ('move', 'Move', '🏃', 14),
    ('feel_better', 'Feel better', '💆', 15),
    ('undefined', 'Undefined', '·', 999)
  on conflict (slug) do update set
    label = excluded.label,
    emoji = excluded.emoji,
    sort_order = excluded.sort_order;
  delete from public.place_families
   where slug not in (
     'coffee','breakfast','quick_bite','pizza','tacos','sushi','burgers',
     'noodles','dinner','sweet','drinks','night_out','go_out',
     'move','feel_better','undefined'
   );
end;
$function$;

select public.seed_place_families();
