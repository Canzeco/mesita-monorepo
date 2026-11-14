import { ConfigPageLayout } from "@/components/ConfigPageLayout";
import { getActivitySummary } from "@/lib/activity-summary";
import { listLogs } from "./actions";
import { LogsClient } from "./LogsClient";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const [initialLogs, initialSummary] = await Promise.all([
    listLogs(),
    getActivitySummary(),
  ]);
  return (
    <ConfigPageLayout
      title="Logs"
      description="A recent activity feed. Enrichment workflow lines stay available for deep debugging."
    >
      <LogsClient initialLogs={initialLogs} initialSummary={initialSummary} />
    </ConfigPageLayout>
  );
}
