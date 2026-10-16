import type { PlaceDetail } from "@mesita/place-profile/types";
import { placeRowToDetail } from "@mesita/place-profile/map";
import type {
  AdminPlace,
  PlaceTagOption,
} from "@/components/place-manage/actions";

// The phone shows the saved overview row. `requested` on that row means
// "someone has asked", not "this operator voted", so the member vote state
// stays false. Distance stays 0 so the chip reads "- km".
export function memberPreviewDetail(
  place: AdminPlace,
  catalog: PlaceTagOption[],
): PlaceDetail {
  const bySlug = new Map(catalog.map((tag) => [tag.slug, tag]));
  const tags = (place.tags ?? []).flatMap((slug) => {
    const tag = bySlug.get(slug);
    return tag ? [tag] : [];
  });
  return placeRowToDetail(
    {
      ...(place as unknown as Record<string, unknown>),
      requested: false,
      distance_km: 0,
    },
    tags,
  );
}
