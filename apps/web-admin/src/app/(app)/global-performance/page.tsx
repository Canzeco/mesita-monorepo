import { AlertTriangle } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import { listNotifications } from "./actions";
import { GlobalPerformanceClient } from "./GlobalPerformanceClient";
import { TYPES_WITHOUT_STEPS } from "./notification-feed";

export const dynamic = "force-dynamic";

// Global Monitor — operator activity feed. Domain tabs hit the EF `category`
// param; Intaker steps stay out of the first paint so they don't eat the
// 150-item window (toggle them back on from the filter bar).

export default async function GlobalPerformancePage() {
  const result = await listNotifications("all", { types: TYPES_WITHOUT_STEPS });

  return (
    <PageContainer size="5xl">
      <PageHeader
        eyebrow="Overview · Performance"
        title="Global Monitor"
        description="What happened across Mesita."
      />

      {result.ok ? (
        <GlobalPerformanceClient initial={result.data} />
      ) : (
        <div className="border-destructive/40 bg-destructive/5 text-destructive mt-6 flex items-start gap-3 rounded-2xl border p-4 text-sm sm:mt-8">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Couldn&apos;t load notifications.</p>
            <p className="mt-1 opacity-90">{result.error}</p>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
