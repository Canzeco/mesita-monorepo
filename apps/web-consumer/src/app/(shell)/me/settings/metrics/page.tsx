import { MetricsModal } from "@/components/consumer/me/MetricsModal";

// /me/settings/metrics — lifetime counters. Was a hand-off sheet (MESITA-1789).
export const dynamic = "force-dynamic";

export default function Page() {
  return <MetricsModal />;
}
