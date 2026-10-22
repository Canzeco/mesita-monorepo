import { ReservationDetailFetcher } from "@/components/consumer/reservation-detail-fetch";
import { ReservationPageFrame } from "@/components/consumer/ReservationPageFrame";

export const dynamic = "force-dynamic";

// Hard-nav reservation detail. Soft-nav from /reservations hits the
// intercepted @modal/(.)reservation/[id] variant. The header and scroller
// are ReservationPageFrame, the one this route's loading.tsx draws too.
export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <ReservationPageFrame>
      <ReservationDetailFetcher id={id} />
    </ReservationPageFrame>
  );
}
