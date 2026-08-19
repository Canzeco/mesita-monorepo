// Selected Reservation Endpoint — Notion Docs › Reservations §C.
//
// Seeds products.reservations = { channel, value } for the Reservationist.
// Priority among available profile contacts is an OPERATOR KNOB, not a constant:
// it lives at app_config.reservations_config and is authored on the admin
// console's Reservations Config page (MESITA-623). Callers pass the policy in;
// DEFAULT_RESERVATIONS_POLICY is phone-only (MESITA-842) — the Reservationist is
// voice-reachable only; WhatsApp/Instagram are not serving paths (MESITA-839).
// Never writes fallbacks. No LLM — the order is the product rule.

import {
  availableReservationChannels,
  buildReservationTarget,
  DEFAULT_RESERVATIONS_POLICY,
  preferReservationChannel,
  type ReservationCandidates,
  type ReservationTarget,
  type ReservationsPolicy,
} from "./enrich-reservation-policy.ts";

export {
  availableReservationChannels,
  buildReservationTarget,
  coerceReservationsPolicy,
  DEFAULT_RESERVATIONS_POLICY,
  hasReservationTarget,
  mergeProductsReservations,
  preferReservationChannel,
  RESERVATION_CHANNELS,
  type ReservationCandidates,
  type ReservationChannel,
  type ReservationsPolicy,
  type ReservationTarget,
  valueForReservationChannel,
} from "./enrich-reservation-policy.ts";

/**
 * Select the reservation contact channel for Enricher seeding.
 * Priority + parked channels come from the policy (Reservations Config); the
 * default is phone only. Sync + deterministic (no LLM). Admin override is
 * handled by the caller via hasReservationTarget before invoking this.
 */
export function selectReservationEndpoint(input: {
  candidates: ReservationCandidates;
  policy?: ReservationsPolicy;
}): { target: ReservationTarget | null; diag: Record<string, unknown> } {
  const policy = input.policy ?? DEFAULT_RESERVATIONS_POLICY;
  const available = availableReservationChannels(input.candidates, policy);
  if (available.length === 0) {
    return {
      target: null,
      diag: { ok: false, reason: "no_candidates", disabled: policy.disabled },
    };
  }

  const channel = preferReservationChannel(available, policy);
  if (!channel) {
    return { target: null, diag: { ok: false, reason: "fallback_empty" } };
  }

  const target = buildReservationTarget(channel, input.candidates);
  const via = available.length === 1
    ? "sole_candidate"
    : `priority_${policy.priority.join("_")}`;
  return {
    target,
    diag: { ok: !!target, channel, via, available, disabled: policy.disabled },
  };
}
