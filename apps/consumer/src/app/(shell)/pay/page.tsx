import { redirect } from "next/navigation";

// /pay is the section root — there's no standalone landing surface,
// just two sub-routes (QR + Wallet). Default to QR since it's the
// scan-at-the-bill primary action.
export default function PayIndexPage() {
  redirect("/pay/qr");
}
