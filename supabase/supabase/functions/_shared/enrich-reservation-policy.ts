// Selected Reservation Endpoint — policy helpers.
// Notion Enricher Enrich-Analysis S4 / Product Rules §G.
//
// Priority among available profile contacts is an OPERATOR KNOB, not a constant:
// it lives at app_settings.reservations_config and is authored on the admin
// console's Reservations Config page (MESITA-623). Callers pass the policy in;
// DEFAULT_RESERVATIONS_POLICY (phone > whatsapp > instagram) is the fallback when
// the row hasn't been read — the order this file hardcoded before MESITA-623.

export type ReservationChannel = "phone" | "whatsapp" | "instagram";

/** Every channel a reservation endpoint may use. The config must rank all of them. */
export const RESERVATION_CHANNELS: readonly ReservationChannel[] = [
  "phone",
  "whatsapp",
  "instagram",
] as const;

export type ReservationsPolicy = {
  /** Ordered, most-preferred first. Order IS the rule. */
  priority: readonly ReservationChannel[];
  /** Parked channels — skipped even when they're the place's only contact. */
  disabled: readonly ReservationChannel[];
  /** True: a channel an operator picked by hand survives a re-enrich. */
  respectAdminOverride: boolean;
};

/** Used when no config row was read. Matches the migration's column default. */
export const DEFAULT_RESERVATIONS_POLICY: ReservationsPolicy = {
  priority: RESERVATION_CHANNELS,
  disabled: [],
  respectAdminOverride: true,
};

export type ReservationTarget = {
  channel: ReservationChannel;
  value: string | null;
};

export type ReservationCandidates = {
  phone?: string | null;
  whatsapp_url?: string | null;
  instagram_url?: string | null;
};

function isReservationChannel(v: unknown): v is ReservationChannel {
  return v === "phone" || v === "whatsapp" || v === "instagram";
}

/**
 * Coerce the app_settings.reservations_config jsonb into a usable policy.
 * Anything malformed falls back to the default rather than throwing — a bad row
 * must never stop the Enricher from seeding an endpoint.
 */
export function coerceReservationsPolicy(raw: unknown): ReservationsPolicy {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_RESERVATIONS_POLICY;
  }
  const c = raw as Record<string, unknown>;

  const priority: ReservationChannel[] = Array.isArray(c.priority)
    ? c.priority.filter(isReservationChannel).filter((ch, i, a) => a.indexOf(ch) === i)
    : [];
  // Append any channel the row forgot to rank so it stays reachable, last.
  for (const ch of RESERVATION_CHANNELS) {
    if (!priority.includes(ch)) priority.push(ch);
  }

  const disabled: ReservationChannel[] = Array.isArray(c.disabled)
    ? c.disabled.filter(isReservationChannel)
    : [];

  return {
    priority,
    disabled,
    respectAdminOverride:
      typeof c.respectAdminOverride === "boolean" ? c.respectAdminOverride : true,
  };
}

function trimOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/** Non-empty, non-parked contact values the selector may choose from (priority order). */
export function availableReservationChannels(
  candidates: ReservationCandidates,
  policy: ReservationsPolicy = DEFAULT_RESERVATIONS_POLICY,
): ReservationChannel[] {
  const out: ReservationChannel[] = [];
  for (const channel of policy.priority) {
    if (policy.disabled.includes(channel)) continue;
    if (valueForReservationChannel(candidates, channel)) out.push(channel);
  }
  return out;
}

/** First channel in the configured order that's actually available. */
export function preferReservationChannel(
  available: ReservationChannel[],
  policy: ReservationsPolicy = DEFAULT_RESERVATIONS_POLICY,
): ReservationChannel | null {
  for (const channel of policy.priority) {
    if (policy.disabled.includes(channel)) continue;
    if (available.includes(channel)) return channel;
  }
  return null;
}

export function valueForReservationChannel(
  candidates: ReservationCandidates,
  channel: ReservationChannel,
): string | null {
  if (channel === "phone") return trimOrNull(candidates.phone);
  if (channel === "whatsapp") return trimOrNull(candidates.whatsapp_url);
  return trimOrNull(candidates.instagram_url);
}

export function buildReservationTarget(
  channel: ReservationChannel,
  candidates: ReservationCandidates,
): ReservationTarget | null {
  const value = valueForReservationChannel(candidates, channel);
  if (!value) return null;
  return { channel, value };
}

/** True when products.reservations already has a selected channel (admin override). */
export function hasReservationTarget(products: unknown): boolean {
  if (!products || typeof products !== "object" || Array.isArray(products)) {
    return false;
  }
  const raw = (products as Record<string, unknown>).reservations;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  return isReservationChannel((raw as Record<string, unknown>).channel);
}

/** Merge a reservation target into products without wiping menu / other keys. */
export function mergeProductsReservations(
  products: unknown,
  target: ReservationTarget,
): Record<string, unknown> {
  const base =
    products && typeof products === "object" && !Array.isArray(products)
      ? { ...(products as Record<string, unknown>) }
      : {};
  base.reservations = { channel: target.channel, value: target.value };
  return base;
}
