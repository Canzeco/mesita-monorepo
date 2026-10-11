// The Place screen's spine (MESITA-1537).
//
// One request-cached load feeds every place route, so the layout and the tab
// page each ask and only one EF call happens:
//   getManagePlace — the AdminPlace the manage sections read, plus whether
//                    this caller is a super-admin (admin-web-get-overview)
//
// `getPlaceView` and `visibleTabs` are gone (MESITA-2090): they read the
// business console's get-place, which 404s a place to a non-member, and the
// admin layout had stopped calling either. The tab matrix is
// `adminPlaceTabs()` in manage-single/[id]/access.ts.

import { cache } from "react";
// Re-exported so server callers keep one import site; the vocabulary itself
// lives in a client-safe module (see place-tabs.ts).
export {
  PLACE_TAB_LABEL,
  PLACE_TABS,
  placeTabHref,
  type PlaceTab,
} from "@/lib/place-tabs";
import { getPlaceAndRole } from "@/components/place-manage/actions";
import type { AdminPlace } from "@/components/place-manage/actions";

/** Null when the overview cannot load the place — unknown id, or a failed
 *  read. The layout answers that with notFound(). */
export const getManagePlace = cache(
  async (
    placeId: string,
  ): Promise<{ place: AdminPlace; isSuperAdmin: boolean } | null> => {
    const r = await getPlaceAndRole(placeId);
    return r.ok ? r.data : null;
  },
);
