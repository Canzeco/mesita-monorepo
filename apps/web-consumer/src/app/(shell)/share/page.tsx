import { SharePage } from "@/components/consumer/share/SharePage";

// /share — the app's link and the ways to send it (MESITA-2566). It was the
// bar's Share tab until Wallet took the slot (MESITA-2858); the page stays so
// links already sent keep working.
export default function Page() {
  return <SharePage />;
}
