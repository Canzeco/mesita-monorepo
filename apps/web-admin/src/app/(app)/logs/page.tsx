import { ConfigPageLayout } from "@/components/ConfigPageLayout";
import { listLogs } from "./actions";
import { LogsClient } from "./LogsClient";

// Logs — Testing section. The enrichment workflow's recent app lines.
// The server seeds the first read; the client polls after that.
export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const initial = await listLogs();
  return (
    <ConfigPageLayout
      eyebrow="Testing · Enrichment"
      title="Logs"
      description="Recent lines from the enrichment workflow, newest first. The list refreshes on its own."
    >
      <LogsClient initial={initial} />
    </ConfigPageLayout>
  );
}
