-- The ❓ leftover Super keeps its literal name: label "Undefined", not "Other"
-- (Pato, 2026-08-29 — reverts the label-only polish from 20260829112620).
-- Applied to cloud via MCP as version 20260829200615.
create or replace function public.seed_place_super_categories()
returns void
language plpgsql
set search_path = ''
as $function$
begin
  update public.place_super_categories set sort_order = sort_order + 1000;
  insert into public.place_super_categories (slug, label, emoji, sort_order) values
    ('restaurants',     'Restaurants',       '🍽️', 1),
    ('cafes_bakeries',  'Cafés & Desserts',  '☕', 2),
    ('bars_nightlife',  'Bars & Nightlife',  '🍸', 3),
    ('experiences',     'Experiences',       '🎟️', 4),
    ('culture_arts',    'Culture & Arts',    '🎭', 5),
    ('sports_fitness',  'Sports & Fitness',  '⚽', 6),
    ('wellness_beauty', 'Wellness & Beauty', '💆', 7),
    ('undefined',       'Undefined',         '❓', 999)
  on conflict (slug) do update set
    label      = excluded.label,
    emoji      = excluded.emoji,
    sort_order = excluded.sort_order;
  delete from public.place_super_categories
   where slug not in (
     'restaurants','cafes_bakeries','bars_nightlife','experiences',
     'culture_arts','sports_fitness','wellness_beauty','undefined'
   );
end;
$function$;

comment on function public.seed_place_super_categories() is
  'Admin/reset seed for place_super_categories (total). Service-role only.';

revoke execute on function public.seed_place_super_categories() from public, anon, authenticated;
grant execute on function public.seed_place_super_categories() to service_role;

select public.seed_place_super_categories();

do $$
begin
  if (select label from public.place_super_categories where slug = 'undefined') <> 'Undefined' then
    raise exception 'undefined super label is not Undefined';
  end if;
end;
$$;
