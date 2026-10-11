import { redirect } from "next/navigation";
import { placeTabHref } from "@/lib/place-tabs";

// The bare place address forwards onto Profile.
export const dynamic = "force-dynamic";

export default async function AdminPlaceRootPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(placeTabHref(id, "profile"));
}
