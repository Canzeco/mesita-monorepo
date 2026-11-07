import { redirect } from "next/navigation";
import { placeTabHref } from "@/lib/routes";

// Reviews moved inside Profile (MESITA-3393, Pato: "move reviews inside
// Profile"). The old URL still lands somewhere useful.
export default async function ReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`${placeTabHref(id, "profile")}#reviews`);
}
