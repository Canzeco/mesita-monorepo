import { InvitePinModal } from "@/components/consumer/me/InvitePinModal";

// /me/diamond/invite — the 10-digit PIN. Was /me/class/invite (MESITA-2040).
export const dynamic = "force-dynamic";

export default function Page() {
  return <InvitePinModal />;
}
