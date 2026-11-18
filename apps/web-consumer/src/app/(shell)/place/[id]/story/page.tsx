import { loadPlaceOrLeave } from "@/lib/load-place";
import { StoryPageBody } from "@/components/consumer/StoryPageBody";

export const dynamic = "force-dynamic";

// THE STORY PAGE (MESITA-4303, Pato: "definitely with own subpage, not modal
// weird view"): the Story offer on Offers pushes here. A full page like
// Reserve, never intercepted: @modal has no (.)place/[id]/story. Its address
// is what brings the guest back after posting on Instagram.
export default async function PlaceStoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const place = await loadPlaceOrLeave((await params).id);
  return <StoryPageBody place={place} />;
}
