import { VipModal } from "@/components/consumer/me/VipModal";

// /me/vip — Become VIP (MESITA-4766): an invitation code (the only way since MESITA-4849).
export const dynamic = "force-dynamic";

export default function Page() {
  return <VipModal />;
}
