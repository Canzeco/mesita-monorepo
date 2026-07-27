// EF-side reader for the reservation-agent knobs on app_settings.reservations_config
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
export type ReservationsCallConfig = { testCall: TestCall; attempts: number };

export const ATTEMPTS_MIN = 1;
export const ATTEMPTS_MAX = 3;
export const ATTEMPTS_DEFAULT = 3;

// Current testing seed — while under test the agent dials this ONE number for
// EVERY reservation instead of any real venue. Ships ENABLED so a config row that
// predates the knob (or a reset) can never fall through to a real place. Mirror of
// TEST_CALL_SEED in the web-admin catalog. consumerNumber ships empty — an
// operator sets it in Reservations Config before using it in the Playground.
export const TEST_CALL_SEED: TestCall = { enabled: true, number: "+524445499597", consumerNumber: "" };

/**
 * Coerce the stored reservations_config jsonb into the agent-runtime knobs.
 * Anything missing/malformed resolves to the safe default (test mode on, the test
 * line, 3 attempts) — the calling path must never crash on a bad row, and must
 * never default into ringing a real venue.
 */
export function coerceReservationsCallConfig(raw: unknown): ReservationsCallConfig {
  const c = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const t = c.testCall && typeof c.testCall === "object" && !Array.isArray(c.testCall)
    ? c.testCall as Record<string, unknown>
    : {};
  const attemptsRaw = typeof c.attempts === "number" && Number.isFinite(c.attempts)
    ? Math.round(c.attempts)
    : ATTEMPTS_DEFAULT;
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
    attempts: Math.max(ATTEMPTS_MIN, Math.min(ATTEMPTS_MAX, attemptsRaw)),
  };
}
