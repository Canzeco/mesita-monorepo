// Route contract for the (shell) console — every href in the shell comes
// from here, never a hand-written string, and a test asserts each entry
// maps to a real route file on disk. Same pattern as
// business-route-contract.ts for the legacy console.

export const SHELL_ROUTES = {
  home: "/",
  finances: "/finances",
  members: "/members",
  commercial: "/commercial",
  places: "/places",
  account: "/account",
} as const;

export const PLACE_TABS = ["profile", "services", "status"] as const;
export type PlaceTab = (typeof PLACE_TABS)[number];

export function placePath(id: string, tab?: PlaceTab): string {
  return tab ? `/places/${id}/${tab}` : `/places/${id}`;
}

/** Append the mock-org switch to an href. Default org stays clean URLs. */
export function withOrg(href: string, orgKey: string | null): string {
  if (!orgKey || orgKey === "grupo-ruiz") return href;
  return `${href}${href.includes("?") ? "&" : "?"}org=${encodeURIComponent(orgKey)}`;
}
