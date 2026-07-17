import { RESERVATION_CHANNELS } from "../_shared/enrich-reservation-endpoint.ts";

type ReservationsConfig = {
  priority: string[];
  disabled: string[];
  respectAdminOverride: boolean;
};

const KNOWN = new Set<string>(RESERVATION_CHANNELS);

// Coerce the whole policy. Returns an error string on invalid input — the row is
// never touched on a partial or unknown-channel body.
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

  return {
    ok: true,
    value: { priority, disabled, respectAdminOverride: c.respectAdminOverride },
  };
}
