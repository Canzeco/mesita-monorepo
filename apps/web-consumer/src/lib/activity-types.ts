// THE ACTIVITY CHIPS (MESITA-3697, Pato: "Favorites, Reservations,
// Visits(has payments inside), Vouchers(Prepayments), Gifts"), in his order,
// then Notifications (MESITA-3716, Pato: "add notifications subpage to
// this"). Seven under MESITA-3688: Payments lives inside Visits, Prepayments
// is Vouchers; Notifications left with them and came back last. The one list of
// their slugs: Activity's rail, Me's tiles and the legacy redirects read it,
// so a misspelled `?type=` fails the type check.
//
// A PLAIN MODULE ON PURPOSE: next.config loads legacy-redirects.ts, which
// imports this, so nothing here may import React or a client component.

export const ACTIVITY_TYPES = [
  "favorites",
  "reservations",
  "visits",
  "vouchers",
  "gifts",
  "notifications",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** The chip a bare `/activity` (or an unknown `?type=`) shows. */
export const DEFAULT_ACTIVITY_TYPE: ActivityType = "favorites";

/** The old chips' slugs and where each lives now (MESITA-3697), so a
 *  bookmark or a link from before lands on its new chip. Notifications is a
 *  chip again (MESITA-3716). */
export const RETIRED_ACTIVITY_TYPES: Readonly<Record<string, ActivityType>> = {
  payments: "visits",
  prepayments: "vouchers",
};

/** `/activity?type=<type>`: the chip in the address, so Me's tiles, Back and
 *  a shared link land on it. */
export function activityHref(type: ActivityType): string {
  return `/activity?type=${type}`;
}

/** The chip a `?type=` names, a retired slug's new chip, else Favorites. */
export function activityTypeOf(value: string | null | undefined): ActivityType {
  const v = value ?? "";
  if ((ACTIVITY_TYPES as readonly string[]).includes(v)) {
    return v as ActivityType;
  }
  return RETIRED_ACTIVITY_TYPES[v] ?? DEFAULT_ACTIVITY_TYPE;
}
