import { redirect } from "next/navigation";

// Legacy alias — wallet tab is now /pay/balance.
export default function PayWalletRedirect() {
  redirect("/pay/balance");
}
