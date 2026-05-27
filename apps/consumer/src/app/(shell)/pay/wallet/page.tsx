import { redirect } from "next/navigation";

// /pay/wallet → /coupons. The cashback balance card moved onto the
// Coupons surface; transaction history will follow in a Profile sub-route
// once we ship it.
export default function PayWalletRedirect() {
  redirect("/coupons");
}
