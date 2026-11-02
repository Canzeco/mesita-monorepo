import { cache } from "react";
import { getPlaceAndRole } from "@/components/place-manage/actions";

// One request-cached read feeds every place route (the layout and the tab
// page each ask; one EF call happens). Null when business-web-get-place
// refuses (not yours, unknown) or fails; the layout answers notFound().
export const getManagePlace = cache(async (placeId: string) => {
  const r = await getPlaceAndRole(placeId);
  return r.ok ? r.data : null;
});
