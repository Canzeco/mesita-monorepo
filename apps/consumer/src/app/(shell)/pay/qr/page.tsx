import { redirect } from "next/navigation";

// /pay/qr → /coupons. QR-to-pay now lives on the Coupons surface
// alongside the wallet balance + saved coupons.
export default function PayQrRedirect() {
  redirect("/coupons");
}
