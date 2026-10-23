// THE POST-GOOGLE WIPE — Discovery › General (`discovery_config.general`).
//
// Pato, 2026-08-29: "when searching from Google in Discovery, don't show
// unactive places. Only active places." So this runs on what comes BACK from
// a Google Places query — Autocomplete, Text Search, Nearby — and on the
// Mesita rows those results resolve to. EVERY LANE THAT QUERIES GOOGLE reads
// it: Fast, Deep, Map, and admin's suggest.
//
// NO REVIEWS FLOOR (MESITA-2721): `map.googleMinReviews` (MESITA-2702) is
// retired; the Area box's Minimum Popularity is the quality floor. A Google
// row and a Mesita row answer the same Active check.
//
// IT IS A FILTER, NOT A SIGNAL — it excludes, it never demotes. It is
// Discovery-wide, which is the whole reason it lives on `general` rather
// than being copied into four boxes that could disagree.
//
// TWO SIDES OF THE SAME QUESTION, ONE ANSWER:
//   Google-only row — Google's `businessStatus`.
//   Mesita row      — `business_state`.
// Before this module, on-Mesita rows were waved through ("they're already
// onboarded") and a place the operator had switched Active OFF still came
// back from search. That was the bug.
//
// UNKNOWN DOES NOT CLEAR THE GATE. A null business_state fails it when it
// is on. Same reading as every Mesita floor: a
// floor asks a place to PROVE it clears the bar, and a place with nothing to
// show has not. It is also the only reading that makes "only active
// places" true rather than "active places, plus the ones we couldn't check".

import type { GeneralConfig } from "./discovery-config.ts";

/** The subset of a PostgREST builder a WHERE-clause gate uses. Kept
 *  structural so it is testable without a client. */
export type FilterableQuery<T> = {
  eq: (col: string, val: unknown) => T;
  gte: (col: string, val: unknown) => T;
  lte: (col: string, val: unknown) => T;
};

/** The Pulsing state (`business_state`). Google's own label, verbatim. */
export const OPERATIONAL = "OPERATIONAL";

export type GeneralGateSignals = {
  /** OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY | null. */
  businessStatus?: string | null;
};

export function isOperational(state: unknown): boolean {
  return typeof state === "string" && state.trim() === OPERATIONAL;
}

/** The whole gate, for one place. */
export function clearsGeneralGate(
  general: GeneralConfig,
  signals: GeneralGateSignals,
): boolean {
  return !general.requireActive || isOperational(signals.businessStatus);
}

/**
 * A PostgREST builder, structurally. EF clients carry no `Database` generic,
 * so an ADMIN client's inferred builder type blows TS's instantiation depth
 * the moment it rides a generic helper (the anon client is fine). Callers on
 * the admin client cast to this once, at the query boundary, and cast the
 * result back.
 */
export interface GeneralGateQuery extends FilterableQuery<GeneralGateQuery> {}

/**
 * The same gate as a WHERE clause, for the lanes that fetch their own rows.
 * Pushed into the query because a pool is capped before anything ranks: a
 * cut applied after the fetch does not narrow the catalog, it thins the page
 * the guest receives.
 */
export function applyGeneralGateQuery<T extends FilterableQuery<T>>(
  query: T,
  general: GeneralConfig,
): T {
  return general.requireActive ? query.eq("business_state", OPERATIONAL) : query;
}
