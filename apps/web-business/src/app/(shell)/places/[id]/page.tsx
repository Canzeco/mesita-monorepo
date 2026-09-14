// The bare place URL is Profile's front door (MESITA-1732).
//
// TEMPORARY, not permanent: Profile is where a place opens today, and a 308
// would cache that choice in every browser forever.
import { redirect } from "next/navigation";
import { placeTabHref } from "@/lib/place-tabs";

export const dynamic = "force-dynamic";

export default async function PlaceRootPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(placeTabHref(id, "profile"));
}
