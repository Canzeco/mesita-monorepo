import { RESERVATION_CHANNELS } from "../_shared/enrich-reservation-endpoint.ts";

type ReservationsConfig = {
  priority: string[];
  disabled: string[];
  respectAdminOverride: boolean;
  testCall: { enabled: boolean; number: string };
  attempts: number;
};

const KNOWN = new Set<string>(RESERVATION_CHANNELS);

const ATTEMPTS_MIN = 1;
const ATTEMPTS_MAX = 3;
const ATTEMPTS_DEFAULT = 3;

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
  // "route every call to nowhere" state).
  let testCall = { enabled: false, number: "" };
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

  // attempts — optional. Default 3. Integer, clamped to [1, 3].
  let attempts = ATTEMPTS_DEFAULT;
  if (c.attempts !== undefined) {
    if (typeof c.attempts !== "number" || !Number.isFinite(c.attempts)) {
      return { ok: false, error: "config.attempts must be a number" };
    }
    const n = Math.round(c.attempts);
    if (n < ATTEMPTS_MIN || n > ATTEMPTS_MAX) {
      return { ok: false, error: `config.attempts must be between ${ATTEMPTS_MIN} and ${ATTEMPTS_MAX}` };
    }
    attempts = n;
  }

  return {
    ok: true,
    value: { priority, disabled, respectAdminOverride: c.respectAdminOverride, testCall, attempts },
  };
}
