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

import { withOrg } from "@/lib/console-routes";

// THE TAB MATRIX (Pato, 2026-09-06): Profile · Capabilities · Activity · Admin
// — the same set admin's Single Place uses.
//
// Profile USED to have no segment of its own: it was /places/<id>, and the
// other three hung beneath it. That made the one view an operator is most
// likely to send someone a link to the one view with no link — /places/<id>/profile
// answered 404 (MESITA-1732). It has its own address now, and the bare place
// URL is a temporary redirect onto it, exactly as MESITA-1727 moved the
// Organization screen off `/`.
export const PLACE_TABS = [
  "profile",
  "capabilities",
  "activity",
  "admin",
] as const;
export type PlaceTab = (typeof PLACE_TABS)[number];

export const PLACE_TAB_LABEL: Record<PlaceTab, string> = {
  profile: "Profile",
  capabilities: "Capabilities",
  activity: "Activity",
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
 *  held · org viewer     → Profile + Activity (read surfaces)
 *  held · owner/editor   → Profile + Capabilities + Activity
 *  super-admin           → + Admin (operator internals)
 *
 *  Two callers, one rule (MESITA-1779). The place layout resolves it
 *  server-side for the place you are ON (`visibleTabs` in lib/place-view.ts
 *  delegates here). The rail applies it to every place the organization
 *  holds, from the viewer's org role and super-admin flag, so a place opens
 *  to its views WITHOUT being visited — a toggle that opened onto nothing was
 *  what "the buttons are not working" meant. Held by the active org means the
 *  viewer is a member, so `held` is true for every rail place; the published
 *  set still wins on the place itself, where the server has the last word. */
export function tabsForAccess(access: ViewerAccess): PlaceTab[] {
  if (!access.held) return ["profile"];
  const tabs: PlaceTab[] =
    access.role === "viewer"
      ? ["profile", "activity"]
      : ["profile", "capabilities", "activity"];
  if (access.isSuperAdmin) tabs.push("admin");
  return tabs;
}

/**
 * A tab's href, carrying the active organization.
 *
 * The org is NOT optional decoration. Without it, a multi-org operator who
 * landed on `/places/x?org=B` and clicks a tab loses `org=B`; the rail's
 * switcher then falls back to `organizations[0]`, so it silently jumps to
 * org A and every other nav href follows it. The tab rail sits inside the
 * frame the switcher is pinned to, so an unadorned tab href corrupts the
 * navigation standing beside it.
 */
export function placeTabHref(
  placeId: string,
  tab: PlaceTab,
  organizationId: string | null = null,
): string {
  const base = `/places/${encodeURIComponent(placeId)}`;
  return withOrg(`${base}/${tab}`, organizationId);
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
