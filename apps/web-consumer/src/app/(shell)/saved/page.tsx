import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// /saved is no longer a page of its own — the Reservations bottom-tab surface
// lives at /saved/reservations, and saved places moved to Home > Favorites.
// Bare /saved just forwards to the Reservations list so the tab story stays
// consistent.
export const dynamic = "force-dynamic";

export default function SavedIndexPage() {
  redirect(CONSUMER_ROUTES.saved.reservations);
}
