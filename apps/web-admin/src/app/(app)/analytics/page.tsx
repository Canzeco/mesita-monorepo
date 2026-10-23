import { ConfigPageLayout } from "@/components/ConfigPageLayout";
import { getActivitySummary } from "@/lib/activity-summary";
import { AnalyticsClient } from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const initial = await getActivitySummary();
  return (
    <ConfigPageLayout
      eyebrow="Activity · Analytics"
      title="Analytics"
      description="Configure on Configurations; watch outcomes here."
    >
      <AnalyticsClient initial={initial} />
    </ConfigPageLayout>
  );
}
