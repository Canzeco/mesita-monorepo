import { redirect } from "next/navigation";

// /pay/qr was the original sub-route when Pay had multiple pages
// (qr + wallet). With the BottomNav restructure, /pay collapsed to a
// single surface; this redirect keeps old links working.
export default function PayQrRedirect() {
  redirect("/pay");
}
