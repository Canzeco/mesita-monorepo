// The catalog layer owns no per-place page: place detail is the real
// console at /place/<id>/place/<tab>. This alias exists because the mock
// shell DID ship /places/<id> briefly (#1486 → #1488), so links and
// bookmarks pointing here must land somewhere useful instead of a 404.
import { redirect } from "next/navigation";
import { placePath } from "@/lib/business-route-contract";

export default async function PlacesIdAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(placePath(id));
}
