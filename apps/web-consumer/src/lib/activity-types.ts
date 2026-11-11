// THE ACTIVITY CHIPS (MESITA-3688, Pato: "Notifications, Favorites,
// Reservations, Visits, Payments, Prepayments, Gifts"), in his order. The one
// list of their slugs: Activity's rail, Me's tiles and the legacy redirects
// read it, so a misspelled `?type=` fails the type check.
//
// A PLAIN MODULE ON PURPOSE: next.config loads legacy-redirects.ts, which
// imports this, so nothing here may import React or a client component.

export const ACTIVITY_TYPES = [
  "notifications",
  "favorites",
  "reservations",
  "visits",
  "payments",
  "prepayments",
  "gifts",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** `/activity?type=<type>`: the chip in the address, so Me's tiles, Back and
 *  a shared link land on it. Notifications is the default and carries no
 *  query. */
export function activityHref(type: ActivityType): string {
  return type === "notifications" ? "/activity" : `/activity?type=${type}`;
}

/** The chip a `?type=` names; anything else is Notifications. */
export function activityTypeOf(value: string | null | undefined): ActivityType {
  return (ACTIVITY_TYPES as readonly string[]).includes(value ?? "")
    ? (value as ActivityType)
    : "notifications";
}
