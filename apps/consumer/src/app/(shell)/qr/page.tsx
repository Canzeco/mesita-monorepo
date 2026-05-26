import { redirect } from "next/navigation";

// /qr was the original "My QR" surface. The QR now lives under /pay/qr
// alongside the wallet. Keep this redirect so old links (DMs, prior
// onboarding screens, anything cached on home screens) still land in the
// right place.
export default function LegacyQrRedirect() {
  redirect("/pay/qr");
}
