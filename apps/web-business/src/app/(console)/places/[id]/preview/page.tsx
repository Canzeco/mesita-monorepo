import { redirect } from "next/navigation";
import { placeTabHref } from "@/lib/place-tabs";

// Preview is a button on Profile since MESITA-3136; old links land there.
export default async function PlacePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(placeTabHref(id, "profile"));
}
