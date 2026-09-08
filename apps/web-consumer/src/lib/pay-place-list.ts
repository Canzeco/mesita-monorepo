// Pay (/new-visit) list rules: closest listed Mesita nearby, then name
// search when the guest types. Live tickets belong in Inbox — this surface
// never paints an "Open" chip.

import type { Place, PlacePrediction } from "@/lib/api/places";
import type { SeedPlace } from "@/lib/ticket-seed";

export const PAY_NEARBY_MAX = 50;
export const PAY_SUGGEST_MIN_CHARS = 2;
export const PAY_SUGGEST_DEBOUNCE_MS = 300;

/**
 * Ticketable on Pay: the MESITA PAY capability (Pato, 2026-09-08).
 *
 * It was the Partner fact. Partner says the place PAYS Mesita, which is a
 * commercial state, not an answer to "can a guest settle a bill here" — those
 * came apart the moment Mesita Pay became a capability an org turns on and a
 * place opts into (Docs › Checkout §0). Never `listing_type` (stale enum) and
 * never `promoting` (a place can pause its strategy and still take payment).
 *
 * The value is the EFFECTIVE capability, place AND org, resolved by the
 * `profiles` view — this function reads one fact and derives nothing, because
 * a client that re-derives the chain is a client that disagrees with the
 * server the day the rule changes.
 *
 * ABSENT MEANS NO. A row with no capability fact is not payable. That is the
 * only safe default: offering a place Mesita cannot charge at is a promise
 * the checkout cannot keep.
 */
export function canStartPayVisit(
  row: { mesita_pay_enabled?: boolean | null } | null | undefined,
): boolean {
  return row?.mesita_pay_enabled === true;
}

export type PayListRow = {
  key: string;
  name: string;
  subtitle: string;
  photo: string | null;
  canStart: boolean;
  seed: SeedPlace | null;
};

export function payRowFromPlace(place: Place): PayListRow {
  const subtitle =
    [place.zone, place.category_label ?? place.category]
      .filter(Boolean)
      .join(" · ") || "On Mesita";
  return {
    key: place.id,
    name: place.name,
    subtitle,
    photo: place.photos?.[0] ?? null,
    canStart: canStartPayVisit(place),
    seed: canStartPayVisit(place) ? place : null,
  };
}

/**
 * Only places a guest can actually pay at (Pato, 2026-09-08: "if Mesita Pay
 * enabled or not is the FINAL FILTER to appear there").
 *
 * This replaces sorting payable places to the top and toasting on a tap of the
 * rest. That toast said the right thing at the wrong moment: the guest had
 * already read the list, chosen, and reached for the one place they are
 * standing in, and only then learned it was never an option. A place Mesita
 * cannot take a payment at is not a place to pay at.
 *
 * Order is preserved — distance for the nearby list, relevance for a search —
 * because with nothing unpayable left there is no longer a group to hoist.
 */
export function keepPayable(rows: PayListRow[]): PayListRow[] {
  return rows.filter((row) => row.canStart);
}

/** Name-search hit. Prefer the nearby Place when ids match (photos + promoting). */
export function payRowFromPrediction(
  pred: PlacePrediction,
  nearby: readonly Place[],
): PayListRow {
  const listed = pred.mesitaId
    ? nearby.find((p) => p.id === pred.mesitaId)
    : undefined;
  if (listed) return payRowFromPlace(listed);

  // KNOWN GAP, stated rather than hidden: a suggestion carries no capability
  // fact, so a Mesita place OUTSIDE the nearby 50 cannot be shown as payable
  // even when it is. `canStart: false` filters it out. The alternative is
  // offering a place we cannot charge at, which is the worse failure — and the
  // real fix is `consumer-web-suggest-places` shipping the fact, not the
  // client guessing. Nearby is the closest 50 and the guest is standing in the
  // place, so the miss is narrow.
  const googleOnly = pred.state === "not_in_mesita" || !pred.mesitaId;
  return {
    key: pred.mesitaId ?? `g:${pred.placeId}`,
    name: pred.mainText,
    subtitle: pred.secondaryText || (googleOnly ? "Not on Mesita yet" : "On Mesita"),
    photo: null,
    canStart: false,
    seed: null,
  };
}
