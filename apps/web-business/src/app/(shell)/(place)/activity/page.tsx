import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { getSelection } from "@/lib/selected-place";
import { ActivityTab } from "./ActivityTab";

export const dynamic = "force-dynamic";

export default async function PlaceActivityPage() {
  const { placeId } = await getSelection();
  // A URL is not a capability: the rail hides this for a pool place, and
  // this re-checks. The read is request-cached, so it costs nothing.
  const manage = placeId ? await getManagePlace(placeId) : null;
  if (!manage) notFound();
  return <ActivityTab />;
}
