// Every path in the Business app (MESITA-3103; one helper since MESITA-3141).
// Links, router calls, redirects and Checkout return URLs build their paths
// here, never by hand. Client-safe: no server imports.
//
//   /                       sign in (Google)
//   /auth/post-signin       routes a fresh session to its place or Places
//   /places                 the place switcher: search, Claim, the places you run
//   /account                your Google account and What you pay
//   /claim/<id>             claim one place (deep link: "Is this your business?")
//   /places/<id>/<tab>      one place's page
//
// Old addresses (the phone's More, Products, top-level Payments/Rewards/
// Settings, a place's Billing, Future and Preview, and "internal" for admin,
// MESITA-3143) redirect in one hop from next.config.ts `redirects()`.

export const PLACES = "/places";
export const ACCOUNT = "/account";

// Preview is a modal on Profile, Billing a section of Settings, and Future
// split into Payments and Rewards (MESITA-3136).
export const PLACE_TABS = ["profile", "reviews", "premier", "payments", "products", "rewards", "settings", "admin"] as const;
export type PlaceTab = (typeof PLACE_TABS)[number];

export function placeTabHref(placeId: string, tab: PlaceTab): string {
  return `/places/${encodeURIComponent(placeId)}/${tab}`;
}

/** The Billing section of a place's Settings (MESITA-3136). */
export function billingHref(placeId: string): string {
  return `${placeTabHref(placeId, "settings")}#billing`;
}

/** Claim one place; `added` says Mesita just added it from Google. */
export function claimHref(placeId: string, opts: { added?: boolean } = {}): string {
  return `/claim/${encodeURIComponent(placeId)}${opts.added ? "?added=1" : ""}`;
}

/** An absolute URL on this origin, for Stripe Checkout's return. Browser only. */
export function returnUrl(path: string): string {
  return `${window.location.origin}${path}`;
}

/** Which view a place pathname shows, or null. `/places/<id>/<tab>`. */
export function placeTabFromPathname(pathname: string): PlaceTab | null {
  const parts = pathname.split("/");
  if (parts[1] !== "places") return null;
  const seg = parts[3];
  return (PLACE_TABS as readonly string[]).includes(seg ?? "") ? (seg as PlaceTab) : null;
}

/** The place id in a pathname, or null. */
export function placeIdFromPathname(pathname: string): string | null {
  const parts = pathname.split("/");
  return parts[1] === "places" && parts[2] && parts[2] !== "" ? decodeURIComponent(parts[2]) : null;
}
