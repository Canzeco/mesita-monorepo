import { redirect } from "next/navigation";

// /pay/wallet was the cashback-history sub-route under the old
// multi-page Pay surface. The balance card is now inline on /pay;
// transaction history will land in Profile when we ship it.
export default function PayWalletRedirect() {
  redirect("/pay");
}
