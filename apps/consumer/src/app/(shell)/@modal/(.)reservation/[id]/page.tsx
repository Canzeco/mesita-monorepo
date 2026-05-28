import { notFound } from "next/navigation";
import { ReservationDetailBody } from "@/components/consumer/ReservationDetailBody";
import { ReservationDetailModalShell } from "@/components/consumer/ReservationDetailModalShell";
import { getMockReservationById } from "@/lib/mock/reservations-mock";

export const dynamic = "force-dynamic";

// Intercepted /reservation/[id]. Fires only on soft navigation from
// inside (shell) — e.g. tapping a reservation card on /reservations.
// The underlying list stays mounted; this renders inside the @modal
// slot on top.
//
// Hard navigation (refresh, direct URL, new tab) bypasses the
// interceptor and lands on src/app/(shell)/reservation/[id]/page.tsx —
// the full page.

export default async function ReservationModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reservation = getMockReservationById(id);
  if (!reservation) notFound();

  return (
    <ReservationDetailModalShell venueName={reservation.venueName}>
      <ReservationDetailBody r={reservation} />
    </ReservationDetailModalShell>
  );
}
