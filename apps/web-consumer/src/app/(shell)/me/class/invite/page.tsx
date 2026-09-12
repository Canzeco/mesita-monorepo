import { InvitePinModal } from "@/components/consumer/me/InvitePinModal";

// /me/class/invite — 10-digit PIN. Was a stacked sheet off Class (MESITA-1789).
export const dynamic = "force-dynamic";

export default function Page() {
  return <InvitePinModal />;
}
