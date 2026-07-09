import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// The Rewards surface is parked behind a "Soon" gate, so ticket detail deep
// links bounce back to the gated /rewards panel. The real detail view
// (TicketDetailsRouteClientDynamic + the @modal intercept) stays in the tree
// for the un-park.
export default function PayTicketPage() {
  redirect(CONSUMER_ROUTES.rewards.root);
}
