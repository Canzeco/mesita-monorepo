import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { ReviewsSummary } from "@/components/place-manage/sections/ReviewsSummary";

// The editor itself is mounted by PlaceScroll on every view, so a tab change
// never drops a draft. This page adds Reviews under it (MESITA-3393, Pato:
// "move reviews inside Profile"; it was its own tab, MESITA-3121): Google,
// Instagram and Facebook summaries and the stored Google reviews, read-only.
// getManagePlace is cached per request, so the layout's read is reused.
export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  if (!manage) notFound();
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="mt-8 flex scroll-mt-4 flex-col gap-3">
      <h2 id="reviews-title" className="font-display text-base font-semibold tracking-tight">
        Reviews
      </h2>
      <ReviewsSummary staff={manage.role === "superadmin"} />
    </section>
  );
}
