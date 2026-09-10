-- MESITA-1737 — whether a place takes bookings is ONE fact, and the operator
-- owns it.
--
-- TWO ANSWERS, AND THE WRONG ONE REACHED GUESTS.
--
--   place_profiles.reservation_channel   the operator's own pick, through the
--     Capabilities tab's ChannelPicker, which offers an explicit "Not" whose
--     hint reads "This place does not take reservations."
--
--   place_profiles.reservations_enabled  an LLM guess. Written by
--     `_shared/create-place.ts` at create (`door.reservationsLikely`) and
--     rewritten by `supabase-cron-enrich-place-contents` on every contents
--     run (`place.reservations_enabled = reservationsLikely`).
--
-- Only the second one reaches a guest: `placeReserveActionEnabled` and its
-- web-consumer twin `isReserveActionEnabled` are both
-- `reservations_enabled === true`, and that renders the Reserve CTA. So an
-- operator could answer "Not" and keep taking bookings, or answer "Phone" and
-- have no Reserve button — whichever way the enricher had guessed, and a
-- re-enrichment could flip it back at any time without anyone touching the
-- console.
--
-- Nothing could fix it from the console, either. `RAIL_COLUMNS` in
-- `_shared/place-rails.ts` is {mesita_pay, credits, pickup, delivery} and
-- silently ignores anything else, and `profiles_update()` routes
-- `reservation_channel` and `reservation_target` but not
-- `reservations_enabled` — so a patch naming the bit is 200 OK and no write.
--
-- THE RULE, stated once, here:
--
--   channel set   → the operator answered. reservations_enabled IS
--                   (channel <> 'none'). The enricher's opinion is discarded.
--   channel NULL  → nobody has answered. The enricher's guess stands, which
--                   is what seeds a place the day it is discovered.
--
-- WHY A TRIGGER AND NOT A DOOR. A door only governs the writer that goes
-- through it, and this column has three writers in two runtimes — create,
-- the contents cron, and the console through the `profiles` view. `profiles`
-- is a view over this table, so every one of them lands on THIS table, and a
-- BEFORE row trigger is the only place all three meet. It also means no
-- reader changes: `business-web-get-overview`, `business-web-list-places`,
-- both action-gate twins and every future reader keep reading one column and
-- now cannot disagree with the operator.
--
-- WHY NOT A GENERATED COLUMN. A generated column would have to drop the
-- enricher's seed entirely, and a newly discovered place nobody has answered
-- for still needs one. The asymmetry — operator wins when present, enricher
-- fills the silence — is exactly what a generated column cannot express.

create or replace function public.place_reservations_follow_channel()
returns trigger
language plpgsql
as $$
begin
  -- Treat '' like NULL: the console's `readChannel` maps an unrecognised
  -- value to the empty string, and an empty string is not an answer.
  if nullif(btrim(coalesce(new.reservation_channel, '')), '') is not null then
    new.reservations_enabled := (new.reservation_channel <> 'none');
  end if;
  return new;
end;
$$;

comment on function public.place_reservations_follow_channel() is
  'MESITA-1737: reservations_enabled follows reservation_channel whenever the operator has picked one; the enricher''s guess only survives while the channel is NULL.';

-- Fires on EVERY row write, not only when the channel changes. That is the
-- point: a contents re-run writes `reservations_enabled` while leaving
-- `reservation_channel` alone, and without this it would silently overwrite
-- an operator's answer.
drop trigger if exists place_profiles_reservations_follow_channel on public.place_profiles;
create trigger place_profiles_reservations_follow_channel
  before insert or update on public.place_profiles
  for each row
  execute function public.place_reservations_follow_channel();

-- No client-role EXECUTE. Postgres does not check EXECUTE on a trigger
-- function for the role performing the DML, and every writer of this table is
-- a service-role Edge Function anyway. 20260910025122 revoked the PUBLIC
-- default for new functions, so saying nothing here IS the closed door;
-- service_role holds it through that migration's default grant.

-- ── Backfill: make the stored fact agree with the answers already given ────
--
-- Any row where an operator has picked a channel and the column disagrees is
-- a row currently lying to guests in one direction or the other.
update public.place_profiles
   set reservations_enabled = (reservation_channel <> 'none')
 where nullif(btrim(coalesce(reservation_channel, '')), '') is not null
   and reservations_enabled is distinct from (reservation_channel <> 'none');
