// Selected Reservation Endpoint — Notion Docs › Reservations §C.
//
// Seeds places.reservation_channel / reservation_target for the Reservationist
// (typed columns since MESITA-1208 — routing left the products jsonb).
// The channel is phone, the only one (MESITA-842) — the Reservationist is
// voice-reachable only; WhatsApp/Instagram are not serving paths (MESITA-839).
// The Reservations Config knobs that ranked and parked channels (MESITA-623)
// are no longer read (MESITA-2144); respectAdminOverride, the one left, is
// applied by the caller. Never writes fallbacks. No LLM — the order is the
// product rule.

import {
  availableReservationChannels,
  buildReservationTarget,
  preferReservationChannel,
  type ReservationCandidates,
  type ReservationTarget,
} from "./enrich-reservation-policy.ts";

export {
  availableReservationChannels,
  buildReservationTarget,
  coerceReservationsPolicy,
  DEFAULT_RESERVATIONS_POLICY,
  hasReservationTarget,
  preferReservationChannel,
  reservationTargetPatch,
  RESERVATION_CHANNELS,
  type ReservationCandidates,
  type ReservationChannel,
  type ReservationsPolicy,
  type ReservationTarget,
  valueForReservationChannel,
} from "./enrich-reservation-policy.ts";

/**
 * Select the reservation contact channel for Enricher seeding: the first
 * channel in RESERVATION_CHANNELS the place has a contact for. Sync +
 * deterministic (no LLM). Admin override is handled by the caller via
 * hasReservationTarget + policy.respectAdminOverride before invoking this.
 */
export function selectReservationEndpoint(input: {
  candidates: ReservationCandidates;
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
  const via = available.length === 1 ? "sole_candidate" : "channel_order";
  return {
    target,
    diag: { ok: !!target, channel, via, available },
  };
}
