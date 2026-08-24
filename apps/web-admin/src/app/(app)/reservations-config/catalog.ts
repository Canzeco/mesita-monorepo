// Reservations Config catalog — the human-facing names behind the reservation agent.
//
// Mesita books tables with the Reservationist: a Supabase function briefs an
// ElevenLabs voice agent with the place + the guest's parameters, then the agent
// phones the place over Twilio and holds the table. This page is where an operator
// tunes that agent — the number it calls while we test, how hard it retries, and
// the booking channel (phone — voice-only since MESITA-842 / MESITA-839).
//
// Every place carries ONE selected reservation endpoint, in the typed pair
// places.reservation_channel / places.reservation_target (MESITA-1208 moved it
// out of the products jsonb; MESITA-1211 dropped the leftovers) — the address
// the Reservationist dials. The Intaker seeds phone from places.phone.
// WhatsApp / Instagram are not serving paths (no Twilio Messages.json; fleet
// is voice-only).
//
// The channel keys are the contract shared with the Edge Functions
// (admin-web-{get,update}-reservations-config) and with
// supabase/functions/_shared/enrich-reservation-endpoint.ts — keep them in
// lock-step. The testCall + attempts knobs are read by the calling
// orchestration; they persist through the same whole-blob save.

type ReservationChannel = "phone";

export type ReservationsConfig = {
  /** Ordered, most preferred first. Order IS the rule. Always ranks every channel. */
  priority: ReservationChannel[];
  /** Parked channels — skipped even when they're the place's only contact. */
  disabled: ReservationChannel[];
  /** True: a channel an operator picked by hand is never re-seeded by an enrich. */
  respectAdminOverride: boolean;
  /**
   * Testing override. While enabled, EVERY reservation call dials `number`
   * instead of the place's real line — no matter which place the guest booked —
   * so we never ring a real business during testing (reserve from the consumer
   * app to test end-to-end). `consumerNumber` is legacy from the retired admin
   * Playground — never read by the calling path, kept only so stored rows stay
   * shape-stable ('' = unset).
   */
  testCall: { enabled: boolean; number: string; consumerNumber: string };
  /**
   * FIXED at 2 by protocol — not configurable. Attempt 1 always fires
   * immediately when the guest taps Reserve (many places run a 24/7 AI
   * receptionist); attempt 2 fires 5 minutes later if the place is open, else
   * 30 minutes after it next opens. Coerce pins this to ATTEMPTS regardless of
   * what the stored row says.
   */
  attempts: number;
  /**
   * TESTING ONLY. While on, `consumer-web-create-reservation` skips the
   * per-class monthly reservation cap for EVERY consumer, so a tester can keep
   * booking past the Standard limit. Off in any real run — it hides the exact
   * paywall the Premium upsell depends on.
   */
  unlimitedReservations: boolean;
  /**
   * Abuse/cost guards (eng-review 2026-08-04). Every unit of abuse in this
   * system is a REAL metered phone call, so the doors are capped: reschedules
   * per ticket per day (each one resets call_attempts = buys place calls),
   * outbound place calls per place per day (booking + notices share the
   * meter), and the kill switch — a hard stop on ALL outbound reservation
   * calls, parked (not dropped) so flipping it back resumes within a minute.
   */
  limits: {
    reschedulesPerTicketPerDay: number;
    venueCallsPerPlacePerDay: number;
    killSwitch: boolean;
  };
};

/** One reservation the operator must look at — see the get EF's feed query. */
export type NeedsAttentionRow = {
  id: string;
  reference_code: string | null;
  status: string;
  reserved_at: string;
  last_call_status: string | null;
  notice_state: string | null;
  notice_kind: string | null;
  attempts_state: string | null;
  callback_state: string | null;
  consumer_confirmed_at: string | null;
  is_test: boolean | null;
};

const LIMITS_SEED = {
  reschedulesPerTicketPerDay: 3,
  venueCallsPerPlacePerDay: 10,
  killSwitch: false,
};

const CHANNEL_KEYS: ReservationChannel[] = ["phone"];

const ATTEMPTS = 2;

type Channel = {
  key: ReservationChannel;
  label: string;
  emoji: string;
  /** The places column the endpoint value is read from. */
  source: string;
  blurb: string;
};

export const CHANNELS: Channel[] = [
  {
    key: "phone",
    label: "Phone",
    emoji: "☎️",
    source: "places.phone",
    blurb:
      "A voice call to the place's line — the only channel the Reservationist books through. Nearly every place has one, and it reaches a human (or their AI receptionist) who can hold a table. WhatsApp and Instagram are not booking channels (voice fleet only).",
  },
];

// Current testing seed (Pato, 2026-07-17): while the agent is under test it dials
// this one number for EVERY reservation instead of any real place. Fully editable
// from the admin page — this is only what the page (and a fresh/reset config row)
// starts from. Ships ON so a missing config can never fall through to a real place.
// consumerNumber is legacy (retired Playground) and stays empty.
const TEST_CALL_SEED = { enabled: true, number: "+524445499597", consumerNumber: "" };

export const DEFAULT_CONFIG: ReservationsConfig = {
  priority: ["phone"],
  disabled: [],
  respectAdminOverride: true,
  testCall: { ...TEST_CALL_SEED },
  attempts: ATTEMPTS,
  unlimitedReservations: false,
  limits: { ...LIMITS_SEED },
};

function isChannel(v: unknown): v is ReservationChannel {
  return v === "phone";
}

/**
 * A loose E.164 check: a leading + and 8–15 digits. Good enough to stop a typo
 * from being saved as the test number; the real validity check is placing a call.
 */
export function looksLikePhone(v: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(v.trim());
}

/**
 * Coerce whatever the row holds into a renderable config. Anything malformed
 * resolves to the default — the page must always be usable, never a blank screen.
 * Mirrors normalizeConfig in the update EF (which is the strict gate on save).
 * Legacy whatsapp/instagram entries are dropped (MESITA-842).
 */
export function coerceConfig(raw: unknown): ReservationsConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return DEFAULT_CONFIG;
  const c = raw as Record<string, unknown>;

  const priority: ReservationChannel[] = Array.isArray(c.priority)
    ? c.priority.filter(isChannel).filter((ch, i, a) => a.indexOf(ch) === i)
    : [];
  // Append any channel the row forgot to rank so it stays reachable, last.
  for (const ch of CHANNEL_KEYS) {
    if (!priority.includes(ch)) priority.push(ch);
  }

  const disabled: ReservationChannel[] = Array.isArray(c.disabled)
    ? c.disabled.filter(isChannel).filter((ch, i, a) => a.indexOf(ch) === i)
    : [];

  const testRaw =
    c.testCall && typeof c.testCall === "object" && !Array.isArray(c.testCall)
      ? (c.testCall as Record<string, unknown>)
      : {};

  return {
    priority,
    disabled,
    respectAdminOverride:
      typeof c.respectAdminOverride === "boolean" ? c.respectAdminOverride : true,
    testCall: {
      enabled: typeof testRaw.enabled === "boolean" ? testRaw.enabled : TEST_CALL_SEED.enabled,
      number: typeof testRaw.number === "string" ? testRaw.number.trim() : TEST_CALL_SEED.number,
      consumerNumber:
        typeof testRaw.consumerNumber === "string"
          ? testRaw.consumerNumber.trim()
          : TEST_CALL_SEED.consumerNumber,
    },
    // Fixed by protocol — whatever an old row stored, the platform runs 2.
    attempts: ATTEMPTS,
    unlimitedReservations: c.unlimitedReservations === true,
    limits: coerceLimits(c.limits),
  };
}

function coerceLimits(raw: unknown): ReservationsConfig["limits"] {
  const l = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
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
    killSwitch: l.killSwitch === true,
  };
}
