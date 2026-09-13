import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { getSelection } from "@/lib/selected-place";
import { ReviewsTab } from "./ReviewsTab";

export const dynamic = "force-dynamic";

// Reviews — the fifth view (MESITA-1807). A pool place has no manage payload
// and no Reviews row in the matrix; typed by hand, it answers 404 rather than
// throwing inside usePlaceContext, the same guard Settings carries.
export default async function ReviewsPage() {
  const { placeId } = await getSelection();
  const manage = placeId ? await getManagePlace(placeId) : null;
  if (!manage) notFound();
  return <ReviewsTab />;
}
