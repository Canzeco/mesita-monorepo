-- MESITA-4931: the app's test guest. Flagged by hand (step 1d); the guest
-- doors read the flag (_shared/test-guest.ts).
alter table public.consumers add column is_test_guest boolean not null default false;
alter table public.places add column is_test_place boolean not null default false;

comment on column public.consumers.is_test_guest is
  'The app''s test account: no money, reserves only at a test place, in nobody''s Social, in no view count (MESITA-4931).';
comment on column public.places.is_test_place is
  'A place Mesita owns, where the test guest may reserve (MESITA-4931).';

-- The test guest is private to everyone, whatever they chose. They still see
-- Social: that is socialBlocked, which reads their own choice.
create or replace function public.consumer_social_level(c public.consumers)
returns text
language sql
stable
as $function$
  select case
           when c.is_test_guest
             or c.social_private
             or c.birth_year is null
             or extract(year from now() at time zone 'utc')::integer - c.birth_year < 19
             then 'private'
           else 'public'
         end
$function$;
