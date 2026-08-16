import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// The reservations LIST moved into the Inbox tab as one of its four sections.
// Kept as a page (not a next.config redirect) so it sits beside the other
// legacy surface redirects and stays greppable from the route tree.
export default function ReservationsLegacyPage() {
  redirect(CONSUMER_ROUTES.inbox.reservations);
}
