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

/**
 * The slot the guest asked for. Partial input defaults from the current
 * reservation (place-local CDMX), so "solo cambia la hora" works without
 * restating the date. `trim` returns the trimmed string (the app); without it
 * the raw string rides through (a2 — parsePlaceLocal trims on its own).
 * `next` is null when the pair doesn't parse.
 */
export function resolveRequestedSlot(
  reservedAt: string,
  newDate: unknown,
  newTime: unknown,
  opts: { trim: boolean },
): { date: string; time: string; next: Date | null } {
  const pick = (v: unknown, dflt: string) =>
    typeof v === "string" && v.trim() ? (opts.trim ? v.trim() : v) : dflt;
  const date = pick(newDate, placeLocalDate(reservedAt));
  const time = pick(newTime, placeLocalTime(reservedAt));
  return { date, time, next: parsePlaceLocal(date, time) };
}

/** The place's longitude (its timezone for the reminder); null when unknown. */
export async function placeLng(
  admin: SupabaseClient,
  placeId: string,
): Promise<number | null> {
  const { data, error } = await admin
    .from("place_profiles")
    .select("lng")
    .eq("id", placeId)
    .maybeSingle();
  if (error) return null;
  return typeof data?.lng === "number" ? data.lng : null;
}

/** The confirm-on-the-spot write: both sides agree, nothing left to call about. */
export function onTheSpotConfirmPatch(args: {
  next: Date;
  lng: number | null;
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
    ...reminderParkPatch(args.lng, args.next, args.notify, now),
    last_call_state: args.lastCallState,
  };
}
