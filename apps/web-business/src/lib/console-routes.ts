// Route contract for the (shell) console — every href comes from here, and
// a test asserts each entry maps to a route file on disk.
//
// FOUR SCREENS (Pato, 2026-09-05): Account · Organization · Org Places ·
// Public Places. Ascending scope, then the split that matters: the places
// this organization holds, and the pool it can claim from.
//
// Place DETAIL is the real console at /place/<id>/... (see
// lib/business-route-contract.ts). Neither places screen owns a per-place
// route of its own; they lead there.

export const SHELL_ROUTES = {
  account: "/account",
  organization: "/",
  places: "/places",
  pool: "/pool",
} as const;

/** Carry the active organization through a link. Organizations are real
 *  rows now, so there is no default to keep clean — the switcher writes
 *  this on every href once an org is selected. */
export function withOrg(href: string, organizationId: string | null): string {
  if (!organizationId) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}org=${encodeURIComponent(organizationId)}`;
}
