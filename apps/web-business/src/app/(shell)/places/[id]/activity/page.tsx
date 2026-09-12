import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { ActivityTab } from "./ActivityTab";

export const dynamic = "force-dynamic";

export default async function PlaceActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // A URL is not a capability: the tab row hides this for a pool place, and
  // this re-checks. The read is request-cached, so it costs nothing.
  const manage = await getManagePlace(id);
  if (!manage) notFound();
  return <ActivityTab />;
}
