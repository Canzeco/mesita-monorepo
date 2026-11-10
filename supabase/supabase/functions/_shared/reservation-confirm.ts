// The guest takes one of the place's OWN offers — the on-the-spot confirm
// that eleven-a2-confirm-reservation (on the phone) and
// consumer-web-confirm-reservation (in the app) share. The place already
// said that slot is free, so the ticket confirms without another place call.
// What differs per door stays a parameter: the date/time trim, the guest's
// notify mode, the last_call_state wording, and the write's match guard
// (the caller passes that to writeReservation).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { parsePlaceLocal, placeLocalDate, placeLocalTime } from "./agent-tools.ts";
import type { ReservationPatch } from "./reservation-doc.ts";
import { reminderParkPatch } from "./reservation-reminder.ts";
import { PLACE_ZONE_COLUMNS, placeZone } from "./local-time.ts";

/**
 * The slot the guest asked for, in the place's zone. Partial input defaults
 * from the current reservation (place-local), so "solo cambia la hora" works without
 * restating the date. `trim` returns the trimmed string (the app); without it
 * the raw string rides through (a2 — parsePlaceLocal trims on its own).
 * `next` is null when the pair doesn't parse.
 */
export function resolveRequestedSlot(
  reservedAt: string,
  newDate: unknown,
  newTime: unknown,
  opts: { trim: boolean },
  zone: string,
): { date: string; time: string; next: Date | null } {
  const pick = (v: unknown, dflt: string) =>
    typeof v === "string" && v.trim() ? (opts.trim ? v.trim() : v) : dflt;
  const date = pick(newDate, placeLocalDate(reservedAt, zone));
  const time = pick(newTime, placeLocalTime(reservedAt, zone));
  return { date, time, next: parsePlaceLocal(date, time, zone) };
}

/** The place's zone (_shared/local-time.ts placeZone): its slots, its
 *  spoken times and its reminder window. A failed read falls back like a
 *  place with no stamp. */
export async function placeZoneOf(
  admin: SupabaseClient,
  placeId: string,
): Promise<string> {
  const { data, error } = await admin
    .from("place_profiles")
    .select(PLACE_ZONE_COLUMNS)
    .eq("id", placeId)
    .maybeSingle();
  return placeZone(error ? null : (data as { timezone?: unknown; lng?: unknown } | null));
}

/** The confirm-on-the-spot write: both sides agree, nothing left to call about. */
export function onTheSpotConfirmPatch(args: {
  next: Date;
  zone: string | null;
  notify: "call" | "app";
  lastCallState: string;
  now?: Date;
}): ReservationPatch {
  const now = args.now ?? new Date();
  const nowIso = now.toISOString();
  return {
    reserved_at: args.next.toISOString(),
    state: "confirmed",
    reported_verdict: "confirmed",
    confirmed_at: nowIso,
    consumer_confirmed_at: nowIso,
    next_attempt_at: null,
    attempts_state: "answered",
    // The guest just answered, by phone or in the app — there is nothing left
    // to call them back about.
    callback_state: "skipped",
    callback_next_attempt_at: null,
    ...reminderParkPatch(args.zone, args.next, args.notify, now),
    last_call_state: args.lastCallState,
  };
}
