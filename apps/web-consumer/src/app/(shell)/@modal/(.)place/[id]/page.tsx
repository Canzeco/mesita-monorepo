import { loadPlaceOrLeave } from "@/lib/load-place";
import { MemberPlaceModal } from "@/components/consumer/MemberPlaceModal";

export const dynamic = "force-dynamic";

export default async function PlaceModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const place = await loadPlaceOrLeave((await params).id);
  return <MemberPlaceModal place={place} />;
}
