// Single source of truth for the safe test-call default, shared with the
// read-path coercion so both directions agree (MESITA-739).
import { TEST_CALL_SEED, type TestCall } from "./reservations-config.ts";

type ReservationsConfig = {
  testCall: TestCall;
  /** Testing escape hatch: ignore the monthly reservation cap (reservation-cap.ts). */
  unlimitedReservations: boolean;
  /** Abuse/cost guards — every unit of abuse here is a metered phone call. */
  limits: {
    reschedulesPerTicketPerDay: number;
    placeCallsPerPlacePerDay: number;
    killSwitch: boolean;
  };
  /** Leg 7 reminder call. Optional — older admin builds omit it → OFF. */
  reminder: { enabled: boolean };
};

// RETIRED KEYS (MESITA-2144): `priority` and `disabled` (they ranked and parked
// a one-channel list nothing reads), `attempts` (fixed at 2 by protocol —
// ATTEMPTS in reservations-config.ts) and `testCall.consumerNumber` (the
// retired Playground's guest line). MESITA-2424 retired `respectAdminOverride`
// with the enrichment stage that read it. A deployed admin build may still post
// any of them with a whole-blob save, so they are ACCEPTED and dropped — never
// validated, never written back.

// A leading + and 8–15 digits. Mirrors looksLikePhone in the admin catalog. The
// real validity check is placing the call — this only stops an obvious typo.
function looksLikePhone(v: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(v);
}

// Coerce the whole policy. Returns an error string on invalid input — the row is
// never touched on a malformed body. Every knob is OPTIONAL and defaults when
// omitted, so deploying this stays backward-compatible with the shipped page.
export function normalizeConfig(
  raw: unknown,
): { ok: true; value: ReservationsConfig } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "config must be an object" };
  }
  const c = raw as Record<string, unknown>;

  // testCall — optional. An ABSENT testCall falls back to TEST_CALL_SEED (test
  // mode ON, the test line), matching coerceReservationsCallConfig's read-path
  // rule that a missing value must never resolve into ringing a real place
  // (MESITA-739). This used to default `enabled:false`, so a payload that simply
  // omitted the field silently disarmed test mode and pointed the agent at real
  // restaurant phone numbers — the write path undoing the read path's invariant.
  // The admin client always sends testCall, so this is defence for partial or
  // external writers, not a change to the console's behavior.
  //
  // When PRESENT it must be well-formed, and an ENABLED override must carry a
  // plausible number (so we can't ship a "route every call to nowhere" state).
  // A sent consumerNumber is ignored (RETIRED KEYS above).
  let testCall: TestCall = { ...TEST_CALL_SEED };
  if (c.testCall !== undefined) {
    if (!c.testCall || typeof c.testCall !== "object" || Array.isArray(c.testCall)) {
      return { ok: false, error: "config.testCall must be an object" };
    }
    const t = c.testCall as Record<string, unknown>;
    if (typeof t.enabled !== "boolean") {
      return { ok: false, error: "config.testCall.enabled must be a boolean" };
    }
    const number = typeof t.number === "string" ? t.number.trim() : "";
    if (t.number !== undefined && typeof t.number !== "string") {
      return { ok: false, error: "config.testCall.number must be a string" };
    }
    if (t.enabled && !looksLikePhone(number)) {
      return {
        ok: false,
        error: "config.testCall.number must be an E.164 phone (e.g. +5215512345678) while the override is on",
      };
    }
    testCall = { enabled: t.enabled, number };
  }

  // unlimitedReservations — optional, defaults OFF so an older admin build that
  // omits the field can never silently switch the cap off. Testing-only knob.
  if (c.unlimitedReservations !== undefined && typeof c.unlimitedReservations !== "boolean") {
    return { ok: false, error: "config.unlimitedReservations must be a boolean" };
  }
  const unlimitedReservations = c.unlimitedReservations === true;

  // limits — optional (older admin builds omit it → seeds), strict when sent.
  // Mirrors LIMITS_SEED in _shared/reservations-config.ts.
  let limits = { reschedulesPerTicketPerDay: 3, placeCallsPerPlacePerDay: 10, killSwitch: false };
  if (c.limits !== undefined) {
    if (!c.limits || typeof c.limits !== "object" || Array.isArray(c.limits)) {
      return { ok: false, error: "config.limits must be an object" };
    }
    const l = c.limits as Record<string, unknown>;
    const readCap = (v: unknown, name: string): number | { error: string } => {
      if (typeof v !== "number" || !Number.isFinite(v) || Math.trunc(v) < 1 || v > 1000) {
        return { error: `config.limits.${name} must be a number between 1 and 1000` };
      }
      return Math.trunc(v);
    };
    const resc = readCap(l.reschedulesPerTicketPerDay, "reschedulesPerTicketPerDay");
    if (typeof resc === "object") return { ok: false, error: resc.error };
    const place = readCap(l.placeCallsPerPlacePerDay, "placeCallsPerPlacePerDay");
    if (typeof place === "object") return { ok: false, error: place.error };
    if (typeof l.killSwitch !== "boolean") {
      return { ok: false, error: "config.limits.killSwitch must be a boolean" };
    }
    limits = {
      reschedulesPerTicketPerDay: resc,
      placeCallsPerPlacePerDay: place,
      killSwitch: l.killSwitch,
    };
  }

  // reminder — optional, defaults OFF so an older admin save can never
  // silently turn on +1 outbound call per confirmed reservation.
  let reminder = { enabled: false };
  if (c.reminder !== undefined) {
    if (!c.reminder || typeof c.reminder !== "object" || Array.isArray(c.reminder)) {
      return { ok: false, error: "config.reminder must be an object" };
    }
    const rem = c.reminder as Record<string, unknown>;
    if (typeof rem.enabled !== "boolean") {
      return { ok: false, error: "config.reminder.enabled must be a boolean" };
    }
    reminder = { enabled: rem.enabled };
  }

  return {
    ok: true,
    value: {
      testCall,
      unlimitedReservations,
      limits,
      reminder,
    },
  };
}
