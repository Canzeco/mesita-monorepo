import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// /pay → default tab (Wallet first in tab order)
export default function PayIndexPage() {
  redirect(CONSUMER_ROUTES.pay.balance);
}
