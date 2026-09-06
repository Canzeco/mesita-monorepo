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
// — the same set admin's Single Place uses. Profile has no segment of its own;
// it IS /places/<id>.
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
 * landed on `/places/x?org=B` and clicks a tab loses `org=B`; `TopNav` then
 * falls back to `organizations[0]`, so the switcher silently jumps to org A
 * and every other nav href follows it. Row 2 sits 56px under that switcher,
 * so an unadorned tab href corrupts the thing directly above it.
 */
export function placeTabHref(
  placeId: string,
  tab: PlaceTab,
  organizationId: string | null = null,
): string {
  const base = `/places/${encodeURIComponent(placeId)}`;
  return withOrg(tab === "profile" ? base : `${base}/${tab}`, organizationId);
}
