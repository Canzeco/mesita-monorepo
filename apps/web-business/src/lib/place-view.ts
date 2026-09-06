// The Place screen's spine (MESITA-1537).
//
// Two request-cached loads feed every place route, so the layout and the tab
// page each ask and only one EF call happens:
//   getPlaceView  — identity, holder, claimable, the 404 verdict
//   getManagePlace — the AdminPlace the ported manage sections read, plus
//                    whether this caller is a super-admin
//
// The TAB MATRIX is the law (Pato, 2026-09-06): Profile · Capabilities ·
// Activity · Admin — the same set admin's Single Place uses. Admin renders
// ONLY for super-admins: every box on it calls admin-web-* endpoints, so a
// restaurant would get 403s rendered as confident falsehoods ("never been
// embedded", eleven blank pipeline pills) plus buttons to approve its own
// ownership proof.

import { cache } from "react";
// Re-exported so server callers keep one import site; the vocabulary itself
// lives in a client-safe module (see place-tabs.ts).
export {
  PLACE_TAB_LABEL,
  PLACE_TABS,
  placeTabHref,
  type PlaceTab,
} from "@/lib/place-tabs";
import type { PlaceTab } from "@/lib/place-tabs";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  apiGetConsolePlace,
  type ConsolePlaceView,
} from "@/lib/api/organizations";
import { getPlaceAndRole } from "@/components/place-manage/actions";
import type { AdminPlace } from "@/components/place-manage/actions";

export const getPlaceView = cache(
  async (client: SupabaseClient, placeId: string): Promise<ConsolePlaceView> =>
    apiGetConsolePlace(client, placeId),
);

/** Null when the caller holds no membership the overview can resolve — a
 *  POOL place, which has no manage surface until it is claimed. */
export const getManagePlace = cache(
  async (
    placeId: string,
  ): Promise<{ place: AdminPlace; isSuperAdmin: boolean } | null> => {
    const r = await getPlaceAndRole(placeId);
    return r.ok ? r.data : null;
  },
);

/** Which tabs this caller may see on this place.
 *  pool place            → Profile only (it carries Claim)
 *  held · org viewer     → Profile + Activity (read surfaces)
 *  held · member/direct  → Profile + Capabilities + Activity
 *  super-admin           → + Admin (operator internals)
 *  held by another org   → never reaches here; get-place answers 404. */
export function visibleTabs(
  view: ConsolePlaceView,
  manage: { isSuperAdmin: boolean } | null,
): PlaceTab[] {
  if (!manage) return ["profile"];
  const viewer = view.holder?.myRole === "viewer";
  const tabs: PlaceTab[] = viewer
    ? ["profile", "activity"]
    : ["profile", "capabilities", "activity"];
  if (manage.isSuperAdmin) tabs.push("admin");
  return tabs;
}
