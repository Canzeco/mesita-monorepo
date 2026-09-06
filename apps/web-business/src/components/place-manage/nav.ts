// The Place screen's four tabs (MESITA-1537): Profile · Capabilities ·
// Activity · Admin — the same set admin's Single Place uses, so the ported
// sections keep their call shape. Business owns its OWN `soon` flags: sharing
// admin's nav module would un-park Activity for both consoles at once.

export const PLACE_MANAGE_TABS = [
  { id: "profile", label: "Profile", soon: false },
  // Admin labels this Controls; Pato's label for the business console is
  // Capabilities. A rename stops at the label — nothing downstream moves.
  { id: "capabilities", label: "Capabilities", soon: false },
  { id: "activity", label: "Activity", soon: false },
  // Operator internals. Rendered only for super-admins; a restaurant never
  // sees the tab at all (autoplan D1, 2026-09-06).
  { id: "admin", label: "Admin", soon: false },
] as const;

export type PlaceManageTab = (typeof PLACE_MANAGE_TABS)[number]["id"];

export function isPlaceManageTab(v: string | null | undefined): v is PlaceManageTab {
  return PLACE_MANAGE_TABS.some((t) => t.id === v);
}

/** Admin's sections call this with admin's ids; map them onto business routes. */
export function placeSectionHref(placeId: string, section: string): string {
  const tab = section === "promos"
    ? "capabilities"
    : section === "place"
    ? "profile"
    : section === "performance"
    ? "activity"
    : section;
  const base = `/places/${encodeURIComponent(placeId)}`;
  return tab === "profile" ? base : `${base}/${tab}`;
}
