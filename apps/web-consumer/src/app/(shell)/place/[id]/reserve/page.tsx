import { loadPlaceOrLeave } from "@/lib/load-place";
import { ReservePageBody } from "@/components/consumer/ReservePageBody";

export const dynamic = "force-dynamic";

// THE RESERVE PAGE (MESITA-3609): the place's Reserve tile pushes here. A full
// page, never intercepted: @modal has no (.)place/[id]/reserve, and
// isModalContractPath excludes this path, so a push from the place slide-over
// drops the panel. Signed-in only, like every (shell) route.
export default async function PlaceReservePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const place = await loadPlaceOrLeave((await params).id);
  return (
    <ReservePageBody
      place={{
        id: place.id,
        name: place.name,
        hours_table: place.hours_table,
        timezone: place.timezone,
      }}
    />
  );
}
