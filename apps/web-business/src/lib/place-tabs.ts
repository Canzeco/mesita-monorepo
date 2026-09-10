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
