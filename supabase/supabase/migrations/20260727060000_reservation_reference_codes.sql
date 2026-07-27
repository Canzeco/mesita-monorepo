-- Every reservation ticket carries an 8-digit reference code (Product rule,
-- 2026-07-27): human-speakable over the phone, safe to expose to venues and
-- guests, unique per table. Backfill randomizes existing rows; the creator EFs
-- generate on insert and retry on the (astronomically rare) unique collision.
alter table public.reservations
  add column if not exists reference_code text;
alter table public.playground_reservations
  add column if not exists reference_code text;

update public.reservations
  set reference_code = (10000000 + floor(random() * 90000000))::int::text
  where reference_code is null;
update public.playground_reservations
  set reference_code = (10000000 + floor(random() * 90000000))::int::text
  where reference_code is null;

create unique index if not exists reservations_reference_code_key
  on public.reservations (reference_code);
create unique index if not exists playground_reservations_reference_code_key
  on public.playground_reservations (reference_code);
