import { ReservationDetailModalClient } from "@/components/consumer/reservation-detail-fetch";

export const dynamic = "force-dynamic";

// Intercepted soft-nav variant of /saved/reservation/[id]. The client owns the
// slide-over shell (mounted from the segment layout) and fetches the row from
// the list EF — there's no server-side get-by-id.
export default async function SavedReservationModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReservationDetailModalClient id={id} />;
}
