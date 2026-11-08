import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { ReviewsSummary } from "@/components/place-manage/sections/ReviewsSummary";

// The editor itself is mounted by PlaceScroll on every view, so a tab change
// never drops a draft. This page adds the Google Reviews box under it, with
// no section heading (Pato, MESITA-3401: "don't separate by sections"; the
// Google, Instagram and Facebook numbers sit beside their links). Reviews was
// its own tab until MESITA-3393. getManagePlace is cached per request, so the
// layout's read is reused.
export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  if (!manage) notFound();
  return (
    <section id="reviews" aria-label="Google Reviews" className="mt-4 scroll-mt-4 pb-8">
      <ReviewsSummary staff={manage.role === "superadmin"} />
    </section>
  );
}
