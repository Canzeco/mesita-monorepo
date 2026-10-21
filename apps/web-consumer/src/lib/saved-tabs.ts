// The Saved tab's two tabs (MESITA-2521), in a plain module: the server page
// (app/(shell)/saved/page.tsx) calls savedTabFrom, and a function exported
// from a client-directive file cannot run on the server — it 500'd every
// /saved load until MESITA-2523.

export const SAVED_TABS = [
  { key: "favorites", label: "Favorites" },
  { key: "reservations", label: "Reservations" },
] as const;

export type SavedTab = (typeof SAVED_TABS)[number]["key"];

/** The tab an address asks for: `?tab=reservations`, else Favorites. */
export function savedTabFrom(param: string | string[] | undefined): SavedTab {
  return param === "reservations" ? "reservations" : "favorites";
}
