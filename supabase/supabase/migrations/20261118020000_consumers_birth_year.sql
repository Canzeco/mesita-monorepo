-- MESITA-4302 (child of MESITA-4248): the guest gives a year of birth, not a
-- birthday.
--
-- Pato, 2026-11-17, over /me/profile: "Name. Year of birth. Fuck specific
-- age. And ask sex too. keep this easier. cleaner."
--
-- consumers.birth_year is the new source of truth for age. Every row that
-- already has a birthday gets its year, so no onboarded guest is bounced back
-- to /onboard by the gate (consumer-web-signin-phone now checks birth_year).
-- The birthday column stays, unwritten by the apps, until nothing reads it.
-- The age floor becomes year-based: current year − birth_year >= 14
-- (approximate by up to a year, accepted in MESITA-4248).

alter table public.consumers
  add column if not exists birth_year smallint;

alter table public.consumers
  drop constraint if exists consumers_birth_year_range;
alter table public.consumers
  add constraint consumers_birth_year_range
  check (birth_year is null or birth_year between 1900 and 2100);

comment on column public.consumers.birth_year is
  'Year of birth the guest gave (MESITA-4302). Age floor: current year - birth_year >= 14.';

update public.consumers
   set birth_year = extract(year from birthday)::smallint
 where birthday is not null
   and birth_year is null;
