import { redirect } from "next/navigation";

// /qr was the original "My QR" surface. The QR now lives at /pay.
// Kept as a redirect for old DM links, prior onboarding screens, and
// anything cached on home screens.
export default function LegacyQrRedirect() {
  redirect("/pay");
}
