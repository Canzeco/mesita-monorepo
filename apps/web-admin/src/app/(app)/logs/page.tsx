import { ConfigPageLayout } from "@/components/admin-ui";
import { getActivitySummary } from "@/lib/activity-summary";
import { getReservationsConfig } from "../reservations-config/actions";
import { listLogs } from "./actions";
import { LogsClient } from "./LogsClient";
import { NeedsAttentionCard } from "./NeedsAttentionCard";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  // Reservations that need a human (MESITA-4293: logs live here, never on a
  // Configurations page). A failed read is shown, not hidden (MESITA-4142).
  const [initialLogs, initialSummary, reservations] = await Promise.all([
    listLogs(),
    getActivitySummary(),
    getReservationsConfig(),
  ]);
  return (
    <ConfigPageLayout
      title="Logs"
      description="A recent activity feed. Enrichment workflow lines stay available for deep debugging."
    >
      <div className="flex flex-col gap-4">
        <NeedsAttentionCard
          rows={reservations.ok ? reservations.needsAttention : []}
          error={reservations.ok ? reservations.needsAttentionError : reservations.error}
          more={reservations.ok ? reservations.needsAttentionMore : false}
        />
        <LogsClient initialLogs={initialLogs} initialSummary={initialSummary} />
      </div>
    </ConfigPageLayout>
  );
}
