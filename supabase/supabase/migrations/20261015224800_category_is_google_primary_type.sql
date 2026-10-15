-- A place's category is Google's primary type, saved as Google spells it.
-- The label is that slug made readable. The Mesita category catalog is not
-- the label, and the label carries no emoji.

create or replace function public.sync_place_category_label()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.category is null or btrim(new.category) = '' then
    new.category_label := null;
    return new;
  end if;

  new.category_label := initcap(replace(btrim(new.category), '_', ' '));
  return new;
end;
$function$;

comment on function public.sync_place_category_label() is
  'Sets category_label from the category slug. No catalog lookup, no emoji.';

update public.place_profiles
   set category_label = initcap(replace(btrim(category), '_', ' '))
 where category is not null
   and btrim(category) <> '';
