// Selected Reservation Endpoint — policy helpers.
// Notion Docs › Reservations §C / MESITA-842.
//
// The Reservationist is voice-only (Twilio + ElevenLabs). WhatsApp was dropped
// fleet-wide (MESITA-839) — nothing calls Messages.json — so the only serving
// channel is phone, and the channel order is fixed here in code. The
// `priority` / `disabled` knobs on app_config.reservations_config ranked and
// parked that one-channel list; they are no longer read (MESITA-2144), so the
// policy is phone, unless respectAdminOverride keeps an operator's own pick.

/** Channels a reservation endpoint may use. Voice-reachable only (MESITA-842). */
export type ReservationChannel = "phone";

/** Every channel a reservation endpoint may use, most-preferred first. */
export const RESERVATION_CHANNELS: readonly ReservationChannel[] = ["phone"] as const;

export type ReservationsPolicy = {
  /** True: a channel an operator picked by hand survives a re-enrich. */
  respectAdminOverride: boolean;
};

/** Used when no config row was read. */
export const DEFAULT_RESERVATIONS_POLICY: ReservationsPolicy = {
  respectAdminOverride: true,
};

export type ReservationTarget = {
  channel: ReservationChannel;
  value: string | null;
};

export type ReservationCandidates = {
  phone?: string | null;
};

/**
 * Coerce the app_config.reservations_config jsonb into a usable policy.
 * Anything malformed falls back to the default rather than throwing — a bad row
 * must never stop the Enricher from seeding an endpoint. Stored `priority` /
 * `disabled` keys are ignored (MESITA-2144).
 */
export function coerceReservationsPolicy(raw: unknown): ReservationsPolicy {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_RESERVATIONS_POLICY;
  }
  const c = raw as Record<string, unknown>;
  return {
    respectAdminOverride:
      typeof c.respectAdminOverride === "boolean" ? c.respectAdminOverride : true,
  };
}

function trimOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/** Non-empty contact values the selector may choose from, in channel order. */
export function availableReservationChannels(
  candidates: ReservationCandidates,
): ReservationChannel[] {
  return RESERVATION_CHANNELS.filter((channel) =>
    valueForReservationChannel(candidates, channel) !== null
  );
}

/** First channel in the fixed order that's actually available. */
export function preferReservationChannel(
  available: ReservationChannel[],
): ReservationChannel | null {
  return RESERVATION_CHANNELS.find((channel) => available.includes(channel)) ?? null;
}

export function valueForReservationChannel(
  candidates: ReservationCandidates,
  channel: ReservationChannel,
): string | null {
  if (channel === "phone") return trimOrNull(candidates.phone);
  return null;
}

export function buildReservationTarget(
  channel: ReservationChannel,
  candidates: ReservationCandidates,
): ReservationTarget | null {
  const value = valueForReservationChannel(candidates, channel);
  if (!value) return null;
  return { channel, value };
}

/**
 * True when an operator already picked a reservation door. The Enricher must
 * not overwrite any of the five stored keys (phone · whatsapp · instagram ·
 * web · none). Auto-seed remains phone-only.
 */
export function hasReservationTarget(
  place: { reservation_channel?: unknown } | null | undefined,
): boolean {
  if (!place || typeof place !== "object") return false;
  const ch = place.reservation_channel;
  return ch === "phone" || ch === "whatsapp" || ch === "instagram" ||
    ch === "web" || ch === "none";
}

/** The column patch that pins a reservation target. */
export function reservationTargetPatch(
  target: ReservationTarget,
): { reservation_channel: ReservationChannel; reservation_target: string | null } {
  return { reservation_channel: target.channel, reservation_target: target.value };
}
