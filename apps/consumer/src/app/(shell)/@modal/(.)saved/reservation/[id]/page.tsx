import { notFound } from "next/navigation";
import { ReservationDetailBody } from "@/components/consumer/ReservationDetailBody";
import { ReservationDetailModalShell } from "@/components/consumer/ReservationDetailModalShell";
import { getMockReservationById } from "@/lib/mock/reservations-mock";

export const dynamic = "force-dynamic";

export default async function SavedReservationModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reservation = getMockReservationById(id);
  if (!reservation) notFound();

  return (
    <ReservationDetailModalShell placeName={reservation.placeName}>
      <ReservationDetailBody r={reservation} />
    </ReservationDetailModalShell>
  );
}
