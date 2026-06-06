import { redirect } from "next/navigation";

// Legacy alias — the wallet is gone; land on the QR tab.
export default function PayWalletRedirect() {
  redirect("/pay/qr");
}
