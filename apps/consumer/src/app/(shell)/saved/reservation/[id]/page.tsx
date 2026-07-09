import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// The Reservations surface is parked behind a "Soon" gate, so reservation
// detail deep links bounce back to the gated list. The real detail view
// (ReservationDetailBody + mock data + the @modal intercept) stays in the
// tree for the un-park.
export default function SavedReservationPage() {
  redirect(CONSUMER_ROUTES.saved.reservations);
}
