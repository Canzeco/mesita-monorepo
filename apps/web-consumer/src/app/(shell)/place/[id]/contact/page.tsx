import { loadPlaceOrLeave } from "@/lib/load-place";
import { PlaceContactPage } from "@/components/consumer/PlaceContactSheet";

export const dynamic = "force-dynamic";

// Contact (MESITA-4111): a page under the place, never a sheet and never
// intercepted. A signed-out visitor can open it; the rows are the place's
// own links.
export default async function PlaceContactRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const place = await loadPlaceOrLeave((await params).id);
  return <PlaceContactPage place={place} />;
}
