import { redirect } from "next/navigation";
import { placeTabHref } from "@/lib/place-tabs";

export default async function PlaceIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(placeTabHref(id, "profile"));
}
