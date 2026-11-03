import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { ReviewsSummary } from "@/components/place-manage/sections/ReviewsSummary";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reviews" };

// The place's reviews for its whole team (MESITA-3121, Pato: "the collection
// of reviews … just to visualize"): Google, Instagram and Facebook summaries
// and the stored Google reviews, read-only. Sync calls paid scrapers
// (business-web-reload-place-reviews, super_admins only), so only Mesita
// staff see it.
export default async function ReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  if (!manage) notFound();
  return <ReviewsSummary staff={manage.role === "superadmin"} />;
}
