// The place tab vocabulary — names, labels, hrefs. Nothing else.
//
// This is split out of `place-view.ts` deliberately (MESITA-1558). That module
// also holds the two `cache()`d server reads, and those reach
// `lib/api/organizations` -> `lib/api/_invoke` and `place-manage/actions`
// -> `lib/supabase-ef` -> `lib/supabase/server`. A "use client" tab row that
// imports the vocabulary from there drags the whole server data layer into its
// bundle graph. `shell-contract.test.ts` names that invariant but cannot catch
// it: its rule is a per-file regex with no transitive walk.
//
// Keep this file free of server imports. It is the half a client component may
// have.

// THE TAB MATRIX: Profile · Reviews · Capabilities · Rewards · Admin, in the
// order the rail lists them under the Place group (Pato, 2026-09-14, a drawing
// of two levels: "Organization / Payments / Credits / Activity / Place(s) →
// Profile / Reviews / Capabilities / Rewards / Admin").
//
// TWO CHANGES FROM THE FLAT SIX (MESITA-1841):
//
//   ACTIVITY LEFT. It was a place view from MESITA-1537 until now. The drawing
//   puts it flush-left with the organization's pages, and that is the right
//   scope: an operator asking "how are we doing" is asking about the business,
//   not about one storefront. `/places/<id>/activity` forwards to the
//   organization's, which opens on the place that was selected.
//
//   REWARDS ARRIVED, split out of Capabilities. Capabilities is the ladder of
//   what a guest CAN do here — accept prepays, pickup, delivery, reservations —
//   plus the internal Settings zone. Rewards is what a guest EARNS: the
//   strategy ladder, Visit Rewards, and the Partnership body that prices them.
//   The two were one 440-line component (`PromosSection`) whose own headings
//   already drew the line; this makes the line an address.
//
// Capabilities is its own name again. MESITA-1815 renamed it to Settings —
// label AND segment — and MESITA-1841 puts both back, because the drawing says
// Capabilities and the word never stopped being the domain's (Notion Main
// §11.2, `state-vocabulary.ts`). `/places/<id>/settings` now forwards here,
// which is the reverse of the rule MESITA-1815 wrote.
//
// Profile USED to have no segment of its own: it was /places/<id>, and the
// other views hung beneath it. That made the one view an operator is most
// likely to send someone a link to the one view with no link — /places/<id>/profile
// answered 404 (MESITA-1732). It has its own address now, and the bare place
// URL is a temporary redirect onto it.
export const PLACE_TABS = [
  "profile",
  "reviews",
  "capabilities",
  "rewards",
  "admin",
] as const;
export type PlaceTab = (typeof PLACE_TABS)[number];

export const PLACE_TAB_LABEL: Record<PlaceTab, string> = {
  profile: "Profile",
  reviews: "Reviews",
  capabilities: "Capabilities",
  rewards: "Rewards",
  admin: "Admin",
};

/** What the rail and the place layout know about a viewer on a place. `role`
 *  is the viewer's role in the organization that holds it; null when nobody
 *  holds it (a pool place). */
export type ViewerAccess = {
  /** An organization holds this place and the viewer is in it. */
  held: boolean;
  role: "owner" | "editor" | "viewer" | null;
  isSuperAdmin: boolean;
};

/** Which tabs a viewer may open on a place — THE matrix, in one place.
 *
 *  pool place            → Profile only (it carries Claim)
 *  held · org viewer     → Profile + Reviews (the read surfaces)
 *  held · owner/editor   → + Capabilities + Rewards
 *  super-admin           → + Admin (operator internals)
 *
 *  A VIEWER LOST A ROW, and did not lose a surface: their third read screen
 *  was Activity, which is the organization's page now and which every member
 *  of the organization can open (MESITA-1841). Capabilities and Rewards both
 *  WRITE, so neither joins the read set.
 *
 *  Two callers, one rule (MESITA-1779). The place layout resolves it
 *  server-side for the place you are ON (`visibleTabs` in lib/place-view.ts
 *  delegates here). The rail applies it to the place it shows, from the
 *  viewer's org role and super-admin flag, so a place opens to its views
 *  WITHOUT being visited; the published set still wins on the place itself,
 *  where the server has the last word. */
export function tabsForAccess(access: ViewerAccess): PlaceTab[] {
  if (!access.held) return ["profile"];
  const tabs: PlaceTab[] =
    access.role === "viewer"
      ? ["profile", "reviews"]
      : ["profile", "reviews", "capabilities", "rewards"];
  if (access.isSuperAdmin) tabs.push("admin");
  return tabs;
}

/** A view's address. No organization rides along any more (MESITA-1807):
 *  the place id names its holder, and the rail reads its scope off the
 *  pathname. */
export function placeTabHref(placeId: string, tab: PlaceTab): string {
  return `/places/${encodeURIComponent(placeId)}/${tab}`;
}

/** Which view a place pathname is showing, or null if it is not one.
 *
 *  ONE reader for the segment→tab rule. It used to be written twice, in the
 *  rail and in the page heading, both as `split("/")[3] ?? "profile"` — the
 *  `??` being the bare-URL special case. Two copies of a routing rule is one
 *  copy too many, and the fallback is now a lie: the bare URL redirects rather
 *  than rendering Profile.
 *
 *  Returns null for anything that is not a known tab, so a future segment
 *  cannot silently light up the Profile row. */
export function placeTabFromPathname(pathname: string): PlaceTab | null {
  const seg = pathname.split("/")[3];
  return (PLACE_TABS as readonly string[]).includes(seg ?? "")
    ? (seg as PlaceTab)
    : null;
}
