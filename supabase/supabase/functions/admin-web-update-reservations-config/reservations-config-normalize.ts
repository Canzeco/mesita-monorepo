import { RESERVATION_CHANNELS } from "../_shared/enrich-reservation-endpoint.ts";

type ReservationsConfig = {
  priority: string[];
  disabled: string[];
  respectAdminOverride: boolean;
  testCall: { enabled: boolean; number: string; consumerNumber: string };
  attempts: number;
  /** Testing escape hatch: ignore the per-class monthly reservation cap. */
  unlimitedReservations: boolean;
  /** Abuse/cost guards — every unit of abuse here is a metered phone call. */
  limits: {
    reschedulesPerTicketPerDay: number;
    venueCallsPerPlacePerDay: number;
    killSwitch: boolean;
  };
};

const KNOWN = new Set<string>(RESERVATION_CHANNELS);

// FIXED at 2 by protocol — not configurable. Any attempts value a client sends
// is accepted and ignored so older admin builds keep saving cleanly.
const ATTEMPTS = 2;

// A leading + and 8–15 digits. Mirrors looksLikePhone in the admin catalog. The
// real validity check is placing the call — this only stops an obvious typo.
function looksLikePhone(v: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(v);
}

// Coerce the whole policy. Returns an error string on invalid input — the row is
// never touched on a partial or unknown-channel body. `testCall` + `attempts` are
// OPTIONAL: a body that omits them (the pre-agent admin build) defaults them, so
// deploying this stays backward-compatible with the currently-shipped page.
export function normalizeConfig(
  raw: unknown,
): { ok: true; value: ReservationsConfig } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "config must be an object" };
  }
  const c = raw as Record<string, unknown>;

  if (!Array.isArray(c.priority)) {
    return { ok: false, error: "config.priority must be an array" };
  }
  const priority: string[] = [];
  for (const ch of c.priority) {
    if (typeof ch !== "string" || !KNOWN.has(ch)) {
      return { ok: false, error: `config.priority has unknown channel "${String(ch)}"` };
    }
    if (!priority.includes(ch)) priority.push(ch);
  }
  // The list is the eligible set as well as the order, so it must be complete —
  // parking a channel is what `disabled` is for. Otherwise a channel silently
  // dropped from the array would be indistinguishable from one never wired.
  if (priority.length !== RESERVATION_CHANNELS.length) {
    return {
      ok: false,
      error: `config.priority must rank every channel (${RESERVATION_CHANNELS.join(", ")})`,
    };
  }

  if (!Array.isArray(c.disabled)) {
    return { ok: false, error: "config.disabled must be an array" };
  }
  const disabled: string[] = [];
  for (const ch of c.disabled) {
    if (typeof ch !== "string" || !KNOWN.has(ch)) {
      return { ok: false, error: `config.disabled has unknown channel "${String(ch)}"` };
    }
    if (!disabled.includes(ch)) disabled.push(ch);
  }
  if (disabled.length === RESERVATION_CHANNELS.length) {
    return {
      ok: false,
      error: "config.disabled cannot park every channel — no place could be booked",
    };
  }

  if (typeof c.respectAdminOverride !== "boolean") {
    return { ok: false, error: "config.respectAdminOverride must be a boolean" };
  }

  // testCall — optional. Default off/empty. When present it must be well-formed,
  // and an ENABLED override must carry a plausible number (so we can't ship a
  // "route every call to nowhere" state). consumerNumber is the Playground's
  // guest-side test line: optional, and E.164 when non-empty ('' = unset).
  let testCall = { enabled: false, number: "", consumerNumber: "" };
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
    if (t.consumerNumber !== undefined && typeof t.consumerNumber !== "string") {
      return { ok: false, error: "config.testCall.consumerNumber must be a string" };
    }
    const consumerNumber = typeof t.consumerNumber === "string" ? t.consumerNumber.trim() : "";
    if (consumerNumber && !looksLikePhone(consumerNumber)) {
      return {
        ok: false,
        error: "config.testCall.consumerNumber must be an E.164 phone (e.g. +5215512345678) or empty",
      };
    }
    testCall = { enabled: t.enabled, number, consumerNumber };
  }

  // attempts — fixed. Whatever the client sent (or didn't), the row stores 2.
  const attempts = ATTEMPTS;

  // unlimitedReservations — optional, defaults OFF so an older admin build that
  // omits the field can never silently switch the cap off. Testing-only knob.
  if (c.unlimitedReservations !== undefined && typeof c.unlimitedReservations !== "boolean") {
    return { ok: false, error: "config.unlimitedReservations must be a boolean" };
  }
  const unlimitedReservations = c.unlimitedReservations === true;

  // limits — optional (older admin builds omit it → seeds), strict when sent.
  // Mirrors LIMITS_SEED in _shared/reservations-config.ts.
  let limits = { reschedulesPerTicketPerDay: 3, venueCallsPerPlacePerDay: 10, killSwitch: false };
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
    const venue = readCap(l.venueCallsPerPlacePerDay, "venueCallsPerPlacePerDay");
    if (typeof venue === "object") return { ok: false, error: venue.error };
    if (typeof l.killSwitch !== "boolean") {
      return { ok: false, error: "config.limits.killSwitch must be a boolean" };
    }
    limits = {
      reschedulesPerTicketPerDay: resc,
      venueCallsPerPlacePerDay: venue,
      killSwitch: l.killSwitch,
    };
  }

  return {
    ok: true,
    value: {
      priority,
      disabled,
      respectAdminOverride: c.respectAdminOverride,
      testCall,
      attempts,
      unlimitedReservations,
      limits,
    },
  };
}
