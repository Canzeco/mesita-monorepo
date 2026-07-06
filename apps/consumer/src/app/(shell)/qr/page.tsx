import { redirect } from "next/navigation";

// Legacy /qr → Pay QR tab.
export default function QrRedirect() {
  redirect("/rewards");
}
