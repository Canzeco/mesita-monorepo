import { redirect } from "next/navigation";
import { placeTabHref } from "@/lib/place-tabs";

// The bare place address forwards onto Admin (MESITA-3103: Profile is edited
// in the Business app now).
export const dynamic = "force-dynamic";

export default async function AdminPlaceRootPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(placeTabHref(id, "admin"));
}
