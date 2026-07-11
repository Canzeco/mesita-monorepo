import { redirect } from "next/navigation";
import { reservationPath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// Hard-nav landing for /reservation/[id] (refresh, direct URL, new tab).
// Soft-nav from inside (shell) — tapping a card on /reservations — hits
// the intercepted variant at (shell)/@modal/(.)reservation/[id]/page.tsx
// which renders inside a modal on top of the underlying surface.
//
// Mocked: ids resolve through getMockReservationById; unknown ids 404.

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(reservationPath(id));
}
