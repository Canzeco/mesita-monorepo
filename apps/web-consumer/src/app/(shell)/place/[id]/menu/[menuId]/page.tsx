import { loadPlaceOrLeave } from "@/lib/load-place";
import { PlaceMenuPage } from "@/components/consumer/MenuViewer";

export const dynamic = "force-dynamic";

// One menu file (MESITA-4111). menuId is the index in the place's menu
// list. A bad index paints the page's own "isn't available" line.
export default async function PlaceMenuRoute({
  params,
}: {
  params: Promise<{ id: string; menuId: string }>;
}) {
  const { id, menuId } = await params;
  const place = await loadPlaceOrLeave(id);
  return <PlaceMenuPage place={place} menuId={menuId} />;
}
