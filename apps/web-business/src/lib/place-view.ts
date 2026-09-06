// The Place screen's shared spine (MESITA-1537).
//
// One request-scoped get-place call feeds the layout (tab row + 404
// verdict) AND whichever tab page renders — React cache() dedupes, so
// authority stays single without prop-threading through a server layout.
//
// The tab MATRIX is the law (autoplan D3): who sees which tabs, decided
// here once, rendered by the layout, enforced again by each tab page
// (a URL is not a capability).

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  apiGetConsolePlace,
  type ConsolePlaceView,
} from "@/lib/api/organizations";

export const getPlaceView = cache(
  async (client: SupabaseClient, placeId: string): Promise<ConsolePlaceView> =>
    apiGetConsolePlace(client, placeId),
);

export const PLACE_TABS = [
  "overview",
  "profile",
  "partnership",
  "performance",
  "settings",
] as const;
export type PlaceTab = typeof PLACE_TABS[number];

export const PLACE_TAB_LABEL: Record<PlaceTab, string> = {
  overview: "Overview",
  profile: "Profile",
  partnership: "Partnership",
  performance: "Performance",
  settings: "Settings",
};

/** The visibility matrix, verbatim from the approved plan:
 *  pool place                → Overview only (+ Claim on it)
 *  held · any org member     → all five (owner-only controls render as
 *                              explained locked states inside the tabs)
 *  held · org viewer         → Overview + Performance
 *  held directly, no org     → all five (the old-style owned place)
 *  held by another org       → never reaches here (get-place 404s). */
export function visibleTabs(view: ConsolePlaceView): PlaceTab[] {
  if (view.holder) {
    if (view.holder.myRole === "viewer") return ["overview", "performance"];
    return [...PLACE_TABS];
  }
  if (view.myDirectRole) return [...PLACE_TABS];
  return ["overview"];
}

export function placeTabHref(placeId: string, tab: PlaceTab): string {
  const base = `/places/${encodeURIComponent(placeId)}`;
  return tab === "overview" ? base : `${base}/${tab}`;
}
