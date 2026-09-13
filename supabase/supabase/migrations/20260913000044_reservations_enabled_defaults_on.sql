-- MESITA-1799 — guest Reserve is offered unless the place has opted out.
--
-- Default false plus fail-closed create-door / contents inference made every
-- newly discovered place look locked next to Order. Docs › Apps names Order
-- as locked by default and does not lock Reserve. Operator "Not"
-- (`reservation_channel = 'none'`) still forces the bit off via
-- place_reservations_follow_channel (MESITA-1737).

alter table public.place_profiles
  alter column reservations_enabled set default true;

comment on column public.place_profiles.reservations_enabled is
  'Guest Reserve CTA. Off only when the operator picked Not (reservation_channel = none) or a contents run confirmed walk-in. Default true (MESITA-1799).';

-- Catch default-false rows left by the fail-closed inferer. Channel = none
-- stays false because of the WHERE; the 1737 trigger would also force it.
update public.place_profiles
   set reservations_enabled = true
 where reservation_channel is distinct from 'none'
   and reservations_enabled is distinct from true;
