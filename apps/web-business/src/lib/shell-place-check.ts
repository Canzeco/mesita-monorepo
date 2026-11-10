"use server";

import { efInvoke } from "@/lib/supabase-ef";

// MESITA-3590: whether a remembered place pick still opens. Mesita staff may
// pick any place, so their pick cannot be checked against the places they
// run; after an admin Reset it named a deleted place and every menu row
// opened "not found". The server answers through the same door the place
// layout reads (business-web-get-place: staff and whoever runs the place;
// 404 for an unknown id).
export async function shellPlaceStatus(placeId: string): Promise<"open" | "gone" | "unknown"> {
  const r = await efInvoke<{ place: { id?: string } | null }>("business-web-get-place", { place_id: placeId });
  if (r.ok) return r.data.place?.id === placeId ? "open" : "gone";
  // 404: no such place (or not yours); 400: not a place id at all.
  // Anything else is a failed read, which proves nothing either way.
  return r.status === 404 || r.status === 400 ? "gone" : "unknown";
}
