import { HelpModal } from "@/components/consumer/me/HelpModal";

// /me/help — Support: legal + version. Was a LocalSheet (MESITA-1789).
export const dynamic = "force-dynamic";

export default function Page() {
  return <HelpModal />;
}
