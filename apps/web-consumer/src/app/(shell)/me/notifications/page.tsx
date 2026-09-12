import { AlertsModal } from "@/components/consumer/me/ActivityModals";

// /me/notifications — Activity alerts. Was a LocalSheet (MESITA-1789).
export const dynamic = "force-dynamic";

export default function Page() {
  return <AlertsModal />;
}
