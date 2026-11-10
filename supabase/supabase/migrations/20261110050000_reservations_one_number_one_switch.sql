-- MESITA-3622 — Reservations: one number, one switch.
--
-- Pato: "Reservations are received via phone." The Reservationist dials the
-- Reservations phone (reservation_target), else Google's (phone); the
-- operator's old channel pick (phone / whatsapp / instagram / web / none)
-- decides nothing any more. So:
--
-- 1. The switch is just the switch. 20260910155651 forced
--    reservations_enabled = (reservation_channel <> 'none') on every row
--    write; Business › Reservations now writes reservations_enabled alone,
--    and the only other writer is Create's one-time seed. Drop the trigger
--    and its function.
-- 2. Reserve needs a number. A place with neither a Reservations phone nor a
--    Google phone cannot be called, so its switch goes Off. (The EFs and the
--    place screen also read "switch AND number", so a number cleared later
--    turns Reserve Off without touching the switch.)
-- 3. Party size is 1–10 (Pato, MESITA-3613) in the database too, not only in
--    the EFs. Live had 0 tickets when this shipped; the guard below refuses
--    to add the CHECK over a row outside it.

drop trigger if exists place_profiles_reservations_follow_channel on public.place_profiles;
drop function if exists public.place_reservations_follow_channel();

update public.place_profiles
   set reservations_enabled = false
 where reservations_enabled
   and coalesce(nullif(btrim(reservation_target), ''), nullif(btrim(phone), '')) is null;

comment on column public.place_profiles.reservations_enabled is
  'Business › Reservations On/Off switch. Reserve is On only with this true AND a number (reservation_target, else phone) — MESITA-3622. reservation_channel decides nothing.';

do $$
begin
  if exists (
    select 1 from public.reservation_tickets
     where party_size is null or party_size not between 1 and 10
  ) then
    raise exception 'MESITA-3622: reservation_tickets has party sizes outside 1–10; fix them before adding the CHECK';
  end if;
end $$;

alter table public.reservation_tickets
  drop constraint if exists reservation_tickets_party_size_check;
alter table public.reservation_tickets
  add constraint reservation_tickets_party_size_check check (party_size between 1 and 10);
