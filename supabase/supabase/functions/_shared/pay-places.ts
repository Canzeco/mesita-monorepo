// THE PAY TAB'S LIST (MESITA-3457): the places a signed-in guest can pay at
// now. The union of places where they hold credit (any switch: credit is the
// place's debt, MESITA-3408), places where the bill can be paid outside
// (`outside_ok`, MESITA-3545: Cash Payments and a place code) and places with
// offers (`offers_ok`). Credit places first, then by distance.
//
// MESITA-4708: no card part for a bill, so no `card_ok` and no
// `card_min_cents` (the card places of MESITA-3457 are gone).
//
// While fewer than OPEN_ALL_BELOW places take a bill paid outside, every one
// of them is listed, nearest first (the /autoplan gate d3a of 2026-11-08: an
// empty list in a young city reads as a broken tab); from OPEN_ALL_BELOW on,
// only those within NEAR_RADIUS_M. The guest's location is never stored and
// never logged.
//
// The tunables live here, one file for the server side; the client's twins
// (the 3-decimal rounding, the 12-hour "Paid" line) live in PayPage.

/** Outside places listed past this many: only those within NEAR_RADIUS_M. */
export const OPEN_ALL_BELOW = 20;
/** The radius once the city has OPEN_ALL_BELOW outside places. */
export const NEAR_RADIUS_M = 2000;
/** The hard cap on one answer. */
export const PAY_PLACES_LIMIT = 50;
/** How long a row says "Paid MX$330 · 14:02" and opens that proof. */
export const PAID_RECENT_HOURS = 12;
// The client rounds a location to 3 decimals (~110 m) before it asks.

export type Coords = { lat: number; lng: number };

/** `{lat, lng}` from the body: both or neither. A malformed one is a 400
 *  `bad_location` naming the field; the client then asks without one. */
export function readLocation(
  b: Record<string, unknown>,
): { ok: true; coords: Coords | null } | { ok: false; field: "lat" | "lng" } {
  const has = (v: unknown) => v !== undefined && v !== null;
  if (!has(b.lat) && !has(b.lng)) return { ok: true, coords: null };
  const lat = b.lat, lng = b.lng;
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) return { ok: false, field: "lat" };
  if (typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180) return { ok: false, field: "lng" };
  return { ok: true, coords: { lat, lng } };
}

/** Great-circle distance in metres, rounded. */
export function distanceM(a: Coords, b: Coords): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

export type PayPlaceInput = {
  place_id: string;
  name: string | null;
  /** The profile picture (profiles.profile_photo), the Wallet cards' round photo. */
  photo: string | null;
  /** The street address as the place reads it (profiles.address). */
  address: string | null;
  lat: number | null;
  lng: number | null;
  tier: number | null;
  mesita_pay: boolean;
  currency: string;
  /** Spendable now: Available minus held (wallet_balances.spendable_cents). */
  available_cents: number;
  pending_cents: number;
  /** A place code is set: the waiter's charge can open here, so the guest
   *  can pay outside (MESITA-3545). */
  outside_ok: boolean;
  /** MESITA-4698: Loyalty Cards is On, so the place has offers (cashback,
   *  and vouchers where it sells them): Pay's Get Offers lists it. */
  offers_ok: boolean;
  paid_recent: { payment_id: string; total_cents: number; paid_at: string } | null;
};

export type PayPlace = Omit<PayPlaceInput, "lat" | "lng" | "tier" | "mesita_pay"> & {
  marks: { tier: number | null; mesita_pay: boolean };
  distance_m: number | null;
  test_mode: boolean;
};

/** Which places the answer lists, in order. Pure: the EF reads the rows,
 *  this decides. `outsidePlaceCount` is how many places take a bill paid
 *  outside in this universe (the d3a switch). */
export function payPlaces(
  rows: PayPlaceInput[],
  opts: { at: Coords | null; outsidePlaceCount: number; testMode: boolean },
): PayPlace[] {
  const near = opts.outsidePlaceCount >= OPEN_ALL_BELOW;
  const out: Array<PayPlace & { credit: boolean }> = [];
  for (const r of rows) {
    const credit = r.available_cents > 0 || r.pending_cents > 0;
    if (!credit && !r.outside_ok && !r.offers_ok) continue;
    const d = opts.at && r.lat !== null && r.lng !== null ? distanceM(opts.at, { lat: r.lat, lng: r.lng }) : null;
    // A place without the guest's credit (outside or offers): within the radius
    // once the city is big enough; with no location, only while every such
    // place is listed.
    if (!credit && near && (d === null || d > NEAR_RADIUS_M)) continue;
    out.push({
      place_id: r.place_id,
      name: r.name,
      photo: r.photo,
      address: r.address,
      marks: { tier: r.tier, mesita_pay: r.mesita_pay },
      distance_m: d,
      currency: r.currency,
      available_cents: r.available_cents,
      pending_cents: r.pending_cents,
      outside_ok: r.outside_ok,
      offers_ok: r.offers_ok,
      test_mode: opts.testMode,
      paid_recent: r.paid_recent,
      credit,
    });
  }
  const nearest = (a: PayPlace, b: PayPlace) => {
    if (a.distance_m !== b.distance_m) {
      if (a.distance_m === null) return 1;
      if (b.distance_m === null) return -1;
      return a.distance_m - b.distance_m;
    }
    return (a.name ?? "").localeCompare(b.name ?? "");
  };
  // The cap keeps every credit place (credit first, then nearest), and the
  // kept list reads nearest first (MESITA-3536: the list shows no credit,
  // so credit-first read as random).
  out.sort((a, b) => (a.credit !== b.credit ? (a.credit ? -1 : 1) : nearest(a, b)));
  return out.slice(0, PAY_PLACES_LIMIT).map(({ credit: _credit, ...p }) => p).sort(nearest);
}
