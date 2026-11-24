import { cache } from "react";
import { getPlaceAndRole } from "@/components/place-manage/actions";

// One request-cached read feeds every place route (the layout and the tab
// page each ask; one EF call happens). Null only when business-web-get-place
// refuses (not yours, unknown, not an id), and the layout answers notFound();
// a failed read throws to (console)/error.tsx, which offers Try again.
export const getManagePlace = cache(async (placeId: string) => {
  const r = await getPlaceAndRole(placeId);
  if (r.ok) return r.data;
  if (r.status === 400 || r.status === 403 || r.status === 404) return null;
  throw new Error(`business-web-get-place: ${r.error}`);
});
