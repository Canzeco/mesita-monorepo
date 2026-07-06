import { redirect } from "next/navigation";
import { CONSUMER_ROUTE_PREFIX } from "@/lib/consumer-route-contract";

// Legacy alias — the wallet is gone; land on the single Rewards page.
// Redirect straight to /pay (not /pay/qr, which would just redirect again).
export default function PayWalletRedirect() {
  redirect(CONSUMER_ROUTE_PREFIX.pay);
}
