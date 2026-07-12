// Selected Reservation Endpoint — Notion Enricher Enrich-Analysis S4 / Product Rules §G.
//
// Seeds products.reservations = { channel, value } for the Reservationist.
// Deterministic priority among available profile contacts:
//   phone > whatsapp > instagram
// Never writes fallbacks. Contents stage skips entirely when admin already set
// a channel (hasReservationTarget). No LLM — the order is the product rule.

export type ReservationChannel = "phone" | "whatsapp" | "instagram";

export type ReservationTarget = {
  channel: ReservationChannel;
  value: string | null;
};

export type ReservationCandidates = {
  phone?: string | null;
  whatsapp_url?: string | null;
  instagram_url?: string | null;
};

/** Fixed Enricher seeding order (Product Rules §G / MESITA-597). */
export const RESERVATION_CHANNEL_PRIORITY: readonly ReservationChannel[] = [
  "phone",
  "whatsapp",
  "instagram",
] as const;

function trimOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/** Non-empty contact values the selector may choose from (priority order). */
export function availableReservationChannels(
  candidates: ReservationCandidates,
): ReservationChannel[] {
  const out: ReservationChannel[] = [];
  for (const channel of RESERVATION_CHANNEL_PRIORITY) {
    if (valueForReservationChannel(candidates, channel)) out.push(channel);
  }
  return out;
}

/** Deterministic phone > whatsapp > instagram among available channels. */
export function preferReservationChannel(
  available: ReservationChannel[],
): ReservationChannel | null {
  for (const channel of RESERVATION_CHANNEL_PRIORITY) {
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
  const channel = (raw as Record<string, unknown>).channel;
  return channel === "phone" || channel === "whatsapp" || channel === "instagram";
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

/**
 * Select the reservation contact channel for Enricher seeding.
 * Exact priority: phone > whatsapp > instagram among non-empty candidates.
 * Sync + deterministic (no LLM). Admin override is handled by the caller via
 * hasReservationTarget before invoking this.
 */
export function selectReservationEndpoint(input: {
  candidates: ReservationCandidates;
  /** @deprecated Ignored — seeding is deterministic (MESITA-597). */
  openaiKey?: string;
  name?: string | null;
  about?: string | null;
}): { target: ReservationTarget | null; diag: Record<string, unknown> } {
  const available = availableReservationChannels(input.candidates);
  if (available.length === 0) {
    return { target: null, diag: { ok: false, reason: "no_candidates" } };
  }

  const channel = preferReservationChannel(available);
  if (!channel) {
    return { target: null, diag: { ok: false, reason: "fallback_empty" } };
  }

  const target = buildReservationTarget(channel, input.candidates);
  const via = available.length === 1 ? "sole_candidate" : "priority_phone_whatsapp_instagram";
  return {
    target,
    diag: { ok: !!target, channel, via, available },
  };
}
