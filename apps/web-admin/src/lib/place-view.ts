// The Place screen's spine (MESITA-1537, MESITA-2180).
//
// One request-cached load feeds every place route, so the layout and the tab
// page each ask and only one EF call happens:
//   getManagePlace — admin-web-get-overview. The AdminPlace, whether this
//                    caller is a super-admin, and the resolved profile
//                    (Family, Category options, tags, field limits).
//
// `getPlaceView` and `visibleTabs` are gone (MESITA-2090): they read the
// business console's get-place, which 404s a place to a non-member, and the
// admin layout had stopped calling either. The tab set is
// `FIRST_STAGE_TABS` in manage-single/[id]/access.ts.

import { cache } from "react";
import { getPlaceAndRole } from "@/components/place-manage/actions";
import type { AdminPlace, ProfileRead } from "@/components/place-manage/actions";

/** Null when the overview cannot load the place — unknown id, or a failed
 *  read. The layout answers that with notFound(). */
export const getManagePlace = cache(
  async (
    placeId: string,
  ): Promise<{ place: AdminPlace; isSuperAdmin: boolean; profile: ProfileRead } | null> => {
    const r = await getPlaceAndRole(placeId);
    return r.ok ? r.data : null;
  },
);
