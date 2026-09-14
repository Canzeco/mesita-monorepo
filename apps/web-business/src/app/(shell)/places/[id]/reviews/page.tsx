import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { ReviewsTab } from "./ReviewsTab";

export const dynamic = "force-dynamic";

// Reviews — the fifth view (MESITA-1807). A pool place has no manage payload
// and no Reviews row in the matrix; typed by hand, it answers 404 rather than
// throwing inside usePlaceContext, the same guard Settings carries.
export default async function ReviewsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const manage = await getManagePlace(id);
  if (!manage) notFound();
  return <ReviewsTab />;
}
