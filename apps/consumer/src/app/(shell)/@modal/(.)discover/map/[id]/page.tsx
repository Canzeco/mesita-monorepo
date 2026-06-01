import { redirect } from "next/navigation";
import { toCanonicalPlaceHrefOrNull } from "@/lib/place-route";

export const dynamic = "force-dynamic";

export default async function DiscoverMapVenueModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(toCanonicalPlaceHrefOrNull(id) ?? "/swipe");
}
