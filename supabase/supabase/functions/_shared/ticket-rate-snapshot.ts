// Ticket rate snapshot — frozen at creation, preferred at bill time (MESITA-912 T9).

import { type PromoRates, ratesFromPlace } from "./lineup-strategy.ts";

const RATE_FIELDS = [
  "welcome_free_rate",
  "welcome_premium_rate",
  "free_rate",
  "premium_rate",
] as const;

/** The four rate columns copied from the place row at ticket creation. */
export function snapshotRatesFromPlace(
  place: Record<string, unknown>,
): Record<string, number | null | string> {
  const rates = ratesFromPlace(place);
  return {
    welcome_free_rate: rates.welcome_free_rate,
    welcome_premium_rate: rates.welcome_premium_rate,
    free_rate: rates.free_rate,
    premium_rate: rates.premium_rate,
    rates_snapshotted_at: new Date().toISOString(),
  };
}

/** True when this ticket row carries a creation-time rate snapshot. */
export function hasTicketRateSnapshot(ticket: Record<string, unknown>): boolean {
  return ticket.rates_snapshotted_at != null;
}

/** Prefer snapshotted ticket rates; fall back to live place rates for legacy rows. */
export function ratesForBilling(
  ticket: Record<string, unknown>,
  place: Record<string, unknown>,
): PromoRates {
  if (hasTicketRateSnapshot(ticket)) return ratesFromPlace(ticket);
  return ratesFromPlace(place);
}

export { RATE_FIELDS };
