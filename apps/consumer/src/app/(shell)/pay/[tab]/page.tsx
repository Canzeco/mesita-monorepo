import { redirect } from "next/navigation";
import { CONSUMER_ROUTE_PREFIX } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// Rewards collapsed to a single page. The old /pay/qr and /pay/tickets tab
// segments (plus legacy /pay/wallet, /pay/balance) now land on /pay. Ticket
// detail routes (/pay/ticket/[id], /pay/tickets/[id]) are separate, more
// specific routes and are unaffected by this catch-all redirect.
export default function LegacyPayTabPage() {
  redirect(CONSUMER_ROUTE_PREFIX.pay);
}
