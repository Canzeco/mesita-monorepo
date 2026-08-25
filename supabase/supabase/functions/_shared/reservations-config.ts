// EF-side reader for the reservation-agent knobs on app_config.reservations_config
// (Test mode number + attempts). Mirrors the coerce in
// apps/web-admin/src/app/(app)/reservations-config/catalog.ts so the admin page and
// the calling EF agree on the shape. The CHANNEL policy
// (priority/disabled/respectAdminOverride) lives in enrich-reservation-policy.ts;
// this module owns the agent-runtime knobs the Reservations Config page added.

// `number` is the BUSINESS-side test line (what the agent dials instead of a
// venue while test mode is on). `consumerNumber` is the GUEST-side test line the
// admin Playground can put in a call brief instead of a real consumer's phone —
// playground-only, never read by the production calling path.
export type TestCall = { enabled: boolean; number: string; consumerNumber: string };

// Abuse/cost guards (eng-review 2026-08-04): every unit of abuse here is a real
// metered phone call, so the doors are capped. Knobs, not constants — tunable
// from the admin Reservations Config page; enforcement lives in the EFs.
export type ReservationLimits = {
  /** Reschedules per ticket per day — each one resets call_attempts (= buys venue calls). */
  reschedulesPerTicketPerDay: number;
  /** Outbound VENUE calls per place per day (booking + notices), any ticket. */
  venueCallsPerPlacePerDay: number;
  /** Hard stop: no outbound reservation call of any kind while on. */
  killSwitch: boolean;
};
export const LIMITS_SEED: ReservationLimits = {
  reschedulesPerTicketPerDay: 3,
  venueCallsPerPlacePerDay: 10,
  killSwitch: false,
};

export type ReminderConfig = {
  /** OFF by default — +1 call per confirmed reservation; flipped deliberately. */
  enabled: boolean;
};
export const REMINDER_SEED: ReminderConfig = { enabled: false };

export type ReservationsCallConfig = {
  testCall: TestCall;
  attempts: number;
  limits: ReservationLimits;
  reminder: ReminderConfig;
};

// FIXED at 2 by protocol — not configurable. Attempt 1 fires immediately;
// attempt 2 fires 5 minutes later if the venue is open, else 30 minutes after
// it next opens (that scheduler is the production follow-up). Coerce pins this
// regardless of what the stored row says.
export const ATTEMPTS = 2;

// Current testing seed — while under test the agent dials this ONE number for
// EVERY reservation instead of any real venue. Ships ENABLED so a config row that
// predates the knob (or a reset) can never fall through to a real place. Mirror of
// TEST_CALL_SEED in the web-admin catalog. consumerNumber ships empty — an
// operator sets it in Reservations Config before using it in the Playground.
export const TEST_CALL_SEED: TestCall = { enabled: true, number: "+524445499597", consumerNumber: "" };

/**
 * Coerce the stored reservations_config jsonb into the agent-runtime knobs.
 * Anything missing/malformed resolves to the safe default (test mode on, the test
 * line) — the calling path must never crash on a bad row, and must never default
 * into ringing a real venue. Attempts are fixed at 2 regardless of the row.
 */
export function coerceReservationsCallConfig(raw: unknown): ReservationsCallConfig {
  const c = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const t = c.testCall && typeof c.testCall === "object" && !Array.isArray(c.testCall)
    ? c.testCall as Record<string, unknown>
    : {};
  return {
    testCall: {
      enabled: typeof t.enabled === "boolean" ? t.enabled : TEST_CALL_SEED.enabled,
      number: typeof t.number === "string" && t.number.trim()
        ? t.number.trim()
        : TEST_CALL_SEED.number,
      consumerNumber: typeof t.consumerNumber === "string"
        ? t.consumerNumber.trim()
        : TEST_CALL_SEED.consumerNumber,
    },
    attempts: ATTEMPTS,
    limits: coerceLimits(c.limits),
    reminder: coerceReminder(c.reminder),
  };
}

function coerceReminder(raw: unknown): ReminderConfig {
  const r = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  return { enabled: r.enabled === true };
}

function coerceLimits(raw: unknown): ReservationLimits {
  const l = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const posInt = (v: unknown, seed: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= 1 ? Math.trunc(v) : seed;
  return {
    reschedulesPerTicketPerDay: posInt(
      l.reschedulesPerTicketPerDay,
      LIMITS_SEED.reschedulesPerTicketPerDay,
    ),
    venueCallsPerPlacePerDay: posInt(
      l.venueCallsPerPlacePerDay,
      LIMITS_SEED.venueCallsPerPlacePerDay,
    ),
    killSwitch: typeof l.killSwitch === "boolean" ? l.killSwitch : LIMITS_SEED.killSwitch,
  };
}
