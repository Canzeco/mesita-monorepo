import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// Legacy — Reservations tab used to live under /saved. Canonical is /reservations.
export default function LegacySavedReservationsPage() {
  redirect(CONSUMER_ROUTES.reservations);
}
