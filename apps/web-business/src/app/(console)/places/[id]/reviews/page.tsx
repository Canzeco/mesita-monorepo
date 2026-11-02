import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { ReviewsSummary } from "@/components/place-manage/sections/ReviewsSummary";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reviews" };

// Mesita staff only (MESITA-3104, moved from web-admin's Single Place):
// Google, Instagram and Facebook summaries and Sync, which calls paid
// scrapers through business-web-reload-place-reviews (super_admins only).
export default async function ReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  if (!manage || manage.role !== "superadmin") notFound();
  return <ReviewsSummary />;
}
