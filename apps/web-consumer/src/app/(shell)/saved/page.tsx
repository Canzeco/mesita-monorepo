import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// /saved is no longer a page — favorites live at /home/favorites; reservations
// at /reservations. Bare /saved forwards to the Reservations list.
export default function SavedIndexRedirect() {
  redirect(CONSUMER_ROUTES.reservations);
}
