import { ReservationDetailModalClient } from "@/components/consumer/reservation-detail-fetch";

export const dynamic = "force-dynamic";

// Intercepted soft-nav variant of /reservation/[id].
export default async function ReservationModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReservationDetailModalClient id={id} />;
}
