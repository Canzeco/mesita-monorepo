// Selected Reservation Endpoint — policy helpers.
// Notion Docs › Reservations §C / MESITA-842.
//
// The Reservationist is voice-only (Twilio + ElevenLabs). WhatsApp was dropped
// fleet-wide (MESITA-839) — nothing calls Messages.json — so the only serving
// channel is phone. Priority / disabled remain operator knobs on
// app_config.reservations_config, but the eligible set is phone alone.
// Legacy stored rows that still list whatsapp/instagram are coerced away.

/** Channels a reservation endpoint may use. Voice-reachable only (MESITA-842). */
export type ReservationChannel = "phone";

/** Every channel a reservation endpoint may use. The config must rank all of them. */
export const RESERVATION_CHANNELS: readonly ReservationChannel[] = ["phone"] as const;

export type ReservationsPolicy = {
  /** Ordered, most-preferred first. Order IS the rule. */
  priority: readonly ReservationChannel[];
  /** Parked channels — skipped even when they're the place's only contact. */
  disabled: readonly ReservationChannel[];
  /** True: a channel an operator picked by hand survives a re-enrich. */
  respectAdminOverride: boolean;
};

/** Used when no config row was read. Matches the phone-only column default. */
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
};

function isReservationChannel(v: unknown): v is ReservationChannel {
  return v === "phone";
}

/**
 * Coerce the app_config.reservations_config jsonb into a usable policy.
 * Anything malformed falls back to the default rather than throwing — a bad row
 * must never stop the Enricher from seeding an endpoint. Legacy whatsapp /
 * instagram entries are dropped (not serving paths since MESITA-839/842).
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
 * True when the place already has a selected *serving* reservation channel
 * (an operator override the Enricher must not overwrite). Reads the typed
 * column — routing left places.products in MESITA-1208. A legacy
 * whatsapp/instagram pick is not an override: it was never dialled
 * (MESITA-842), and the CHECK constraint no longer admits it.
 */
export function hasReservationTarget(
  place: { reservation_channel?: unknown } | null | undefined,
): boolean {
  if (!place || typeof place !== "object") return false;
  return isReservationChannel(place.reservation_channel);
}

/** The column patch that pins a reservation target. */
export function reservationTargetPatch(
  target: ReservationTarget,
): { reservation_channel: ReservationChannel; reservation_target: string | null } {
  return { reservation_channel: target.channel, reservation_target: target.value };
}
