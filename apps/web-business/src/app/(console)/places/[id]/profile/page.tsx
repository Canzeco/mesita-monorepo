import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";

// The editor is mounted by PlaceScroll on every view, so a tab change never
// drops a draft; its last card is Google Reviews (MESITA-3403, one column like
// the rest). This page only 404s a place the caller may not open.
// getManagePlace is cached per request, so the layout's read is reused.
export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  if (!manage) notFound();
  return null;
}
