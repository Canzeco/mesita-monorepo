// Reservations Config catalog — the human-facing names behind the reservation agent.
//
// Mesita books tables with the Reservationist: a Supabase function briefs an
// ElevenLabs voice agent with the venue + the guest's parameters, then the agent
// phones the place over Twilio and holds the table. This page is where an operator
// tunes that agent — the number it calls while we test, how hard it retries, and
// which contact channel it books through.
//
// Every place carries ONE selected reservation endpoint at
// products.reservations = { channel, value } — the address the Reservationist
// dials. The Enricher picks it from an ordered channel priority. TODAY only phone
// is live; WhatsApp + Instagram are reserved for verified partners and switched on
// per-venue from the business console, so the priority list is kept (for that
// launch) but the agent only ever calls a phone.
//
// The channel keys are the contract shared with the Edge Functions
// (admin-web-{get,update}-reservations-config) and with
// supabase/functions/_shared/enrich-reservation-endpoint.ts — keep them in
// lock-step. The testCall + attempts knobs are read by the (future) calling
// orchestration; they persist through the same whole-blob save.

export type ReservationChannel = "phone" | "whatsapp" | "instagram";

/** Live today, or held for a future launch (verified partners only). */
export type ChannelStatus = "live" | "soon";

export type ReservationsConfig = {
  /** Ordered, most preferred first. Order IS the rule. Always ranks every channel. */
  priority: ReservationChannel[];
  /** Parked channels — skipped even when they're the place's only contact. */
  disabled: ReservationChannel[];
  /** True: a channel an operator picked by hand is never re-seeded by an enrich. */
  respectAdminOverride: boolean;
  /**
   * Testing override. While enabled, EVERY reservation call dials `number`
   * instead of the place's real line — no matter which venue the guest booked —
   * so we never ring a real business during testing (reserve from the consumer
   * app to test end-to-end). `consumerNumber` is legacy from the retired admin
   * Playground — never read by the calling path, kept only so stored rows stay
   * shape-stable ('' = unset).
   */
  testCall: { enabled: boolean; number: string; consumerNumber: string };
  /**
   * FIXED at 2 by protocol — not configurable. Attempt 1 always fires
   * immediately when the guest taps Reserve (many venues run a 24/7 AI
   * receptionist); attempt 2 fires 5 minutes later if the venue is open, else
   * 30 minutes after it next opens. Coerce pins this to ATTEMPTS regardless of
   * what the stored row says.
   */
  attempts: number;
};

export const CHANNEL_KEYS: ReservationChannel[] = ["phone", "whatsapp", "instagram"];

export const ATTEMPTS = 2;

export type Channel = {
  key: ReservationChannel;
  label: string;
  emoji: string;
  /** The places column the endpoint value is read from. */
  source: string;
  /** Whether the agent can book through this channel today. */
  status: ChannelStatus;
  blurb: string;
};

export const CHANNELS: Channel[] = [
  {
    key: "phone",
    label: "Phone",
    emoji: "☎️",
    source: "places.phone",
    status: "live",
    blurb:
      "A call to the place's line. The one channel the Reservationist books through today — nearly every place has one, and it reaches a human (or their AI receptionist) who can hold a table.",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    emoji: "💬",
    source: "places.whatsapp_url",
    status: "soon",
    blurb:
      "A WhatsApp thread with the place. Coming later for verified partners — a partner switches their bookings to WhatsApp from the business console. Not used for the 99% of places that stay phone-first.",
  },
  {
    key: "instagram",
    label: "Instagram",
    emoji: "📸",
    source: "places.instagram_url",
    status: "soon",
    blurb:
      "A DM to the place's IG. Coming later for verified partners, set on the business console. Never used automatically — DMs get missed, and most places publish no reservation IG.",
  },
];

// Current testing seed (Pato, 2026-07-17): while the agent is under test it dials
// this one number for EVERY reservation instead of any real venue. Fully editable
// from the admin page — this is only what the page (and a fresh/reset config row)
// starts from. Ships ON so a missing config can never fall through to a real place.
// consumerNumber is legacy (retired Playground) and stays empty.
export const TEST_CALL_SEED = { enabled: true, number: "+524445499597", consumerNumber: "" };

export const DEFAULT_CONFIG: ReservationsConfig = {
  priority: ["phone", "whatsapp", "instagram"],
  // Phone is the only bookable channel today; WhatsApp + Instagram are parked
  // until their verified-partner launch, so the Enricher only ever seeds a phone.
  disabled: ["whatsapp", "instagram"],
  respectAdminOverride: true,
  testCall: { ...TEST_CALL_SEED },
  attempts: ATTEMPTS,
};

function isChannel(v: unknown): v is ReservationChannel {
  return v === "phone" || v === "whatsapp" || v === "instagram";
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
  };
}

