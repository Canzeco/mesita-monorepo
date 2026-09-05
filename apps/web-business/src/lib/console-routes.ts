// Route contract for the (shell) console — every href comes from here and a
// test asserts each entry maps to a route file on disk.
//
// THREE ENTITY LAYERS (Pato, 2026-09-05): Organization · Place · Account.
// Three destinations, no more. Everything else is a section INSIDE its
// layer, never a nav item.

export const SHELL_ROUTES = {
  organization: "/",
  places: "/places",
  account: "/account",
} as const;

export function placePath(id: string): string {
  return `/places/${id}`;
}

/** Append the mock-org switch to an href. Default org stays clean URLs. */
export function withOrg(href: string, orgKey: string | null): string {
  if (!orgKey || orgKey === "grupo-ruiz") return href;
  return `${href}${href.includes("?") ? "&" : "?"}org=${encodeURIComponent(orgKey)}`;
}
