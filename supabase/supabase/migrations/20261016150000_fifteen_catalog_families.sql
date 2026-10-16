-- Fifteen guest families. Undefined stays, and is not a carousel.
-- Wine returns to Drinks. Live returns to Night out.
-- With kids, Outdoors and Culture return to Go out.

create or replace function pg_temp.fold_family_keys(keys text[])
returns text[]
language sql
immutable
as $$
  select coalesce(
    (
      select array_agg(slug order by ord)
      from (
        select distinct on (folded)
          folded as slug,
          case folded
            when 'coffee' then 1
            when 'breakfast' then 2
            when 'quick_bite' then 3
            when 'pizza' then 4
            when 'tacos' then 5
            when 'sushi' then 6
            when 'burgers' then 7
            when 'noodles' then 8
            when 'dinner' then 9
            when 'sweet' then 10
            when 'drinks' then 11
            when 'night_out' then 12
            when 'go_out' then 13
            when 'move' then 14
            when 'feel_better' then 15
            when 'undefined' then 999
            else 500
          end as ord
        from (
          select case slug
            when 'wine' then 'drinks'
            when 'live' then 'night_out'
            when 'with_kids' then 'go_out'
            when 'outdoors' then 'go_out'
            when 'culture' then 'go_out'
            else slug
          end as folded
          from unnest(keys) as slug
        ) mapped
        order by folded
      ) deduped
    ),
    array['undefined']::text[]
  );
$$;

update public.place_categories
   set family_keys = pg_temp.fold_family_keys(family_keys)
 where family_keys && array['wine', 'live', 'with_kids', 'outdoors', 'culture']::text[];

update public.catalog_membership
   set family_keys = pg_temp.fold_family_keys(family_keys)
 where family_keys && array['wine', 'live', 'with_kids', 'outdoors', 'culture']::text[];

delete from public.place_families
 where slug in ('wine', 'live', 'with_kids', 'outdoors', 'culture');

update public.place_families
   set sort_order = sort_order + 100
 where slug <> 'undefined';

update public.place_families as f
   set sort_order = v.ord
  from (values
    ('coffee', 1),
    ('breakfast', 2),
    ('quick_bite', 3),
    ('pizza', 4),
    ('tacos', 5),
    ('sushi', 6),
    ('burgers', 7),
    ('noodles', 8),
    ('dinner', 9),
    ('sweet', 10),
    ('drinks', 11),
    ('night_out', 12),
    ('go_out', 13),
    ('move', 14),
    ('feel_better', 15)
  ) as v(slug, ord)
 where f.slug = v.slug;

create or replace function public.atlas_family_slugs_valid(slugs text[])
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    slugs is not null
    and cardinality(slugs) <= 15
    and (select count(distinct x) from unnest(slugs) as x) = cardinality(slugs)
    and not ('undefined' = any(slugs) and cardinality(slugs) > 1)
    and not exists (
      select 1
      from unnest(slugs) as s
      where not exists (
        select 1 from public.place_families p
        where p.slug = s
      )
    );
$$;

create or replace function public.seed_place_families()
returns void
language plpgsql
set search_path to ''
as $function$
begin
  update public.place_families set sort_order = sort_order + 1000 where true;
  insert into public.place_families (slug, label, emoji, sort_order) values
    ('coffee', 'Coffee', '·', 1),
    ('breakfast', 'Breakfast', '·', 2),
    ('quick_bite', 'Quick bite', '·', 3),
    ('pizza', 'Pizza', '·', 4),
    ('tacos', 'Tacos', '·', 5),
    ('sushi', 'Sushi', '·', 6),
    ('burgers', 'Burgers', '·', 7),
    ('noodles', 'Noodles', '·', 8),
    ('dinner', 'Dinner', '·', 9),
    ('sweet', 'Sweet', '·', 10),
    ('drinks', 'Drinks', '·', 11),
    ('night_out', 'Night out', '·', 12),
    ('go_out', 'Go out', '·', 13),
    ('move', 'Move', '·', 14),
    ('feel_better', 'Feel better', '·', 15),
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
