import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// /pay → default tab (QR).
export default function PayIndexPage() {
  redirect(CONSUMER_ROUTES.pay.qr);
}
