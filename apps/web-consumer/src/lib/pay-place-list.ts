// Pay (/new-visit) list rules: closest listed Mesita nearby, then name
// search when the guest types. Live tickets belong in Inbox — this surface
// never paints an "Open" chip.

import { isPromoting } from "@/lib/promo-rates";
import type { Place, PlacePrediction } from "@/lib/api/places";
import type { SeedPlace } from "@/lib/ticket-seed";

export const PAY_NEARBY_MAX = 50;
export const PAY_SUGGEST_MIN_CHARS = 2;
export const PAY_SUGGEST_DEBOUNCE_MS = 300;

/** Ticketable on Pay: the live promoting flag, never listing_type. */
export function canStartPayVisit(
  row: { promoting?: boolean | null } | null | undefined,
): boolean {
  return isPromoting(row);
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
 * Payable places first, then the rest, each group keeping the order it came in
 * (distance for the nearby list, relevance for a name search).
 *
 * This is the other half of dropping the per-row Soon badge. The badge was
 * carried by the MAJORITY of rows, so it distinguished nothing and just
 * repeated the same state fifty times; the signal belongs on the exception.
 * But an exception buried at row 34 is not a signal either — a guest scanning
 * a billboard reads the top. Sorting is what makes the chip findable, and
 * `sort` is stable in every engine this ships to, so neither group scrambles.
 */
export function sortPayableFirst(rows: PayListRow[]): PayListRow[] {
  return [...rows].sort(
    (a, b) => Number(b.canStart) - Number(a.canStart),
  );
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

  const googleOnly = pred.status === "not_in_mesita" || !pred.mesitaId;
  const seed: SeedPlace | null =
    googleOnly || !pred.mesitaId
      ? null
      : { id: pred.mesitaId, name: pred.mainText };
  return {
    key: pred.mesitaId ?? `g:${pred.placeId}`,
    name: pred.mainText,
    subtitle: pred.secondaryText || (googleOnly ? "Not on Mesita yet" : "On Mesita"),
    photo: null,
    canStart: seed != null,
    seed,
  };
}
