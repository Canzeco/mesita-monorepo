import { AlertTriangle } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import { listNotifications } from "./actions";
import { GlobalPerformanceClient } from "./GlobalPerformanceClient";

// Global Performance console. The first view is Notifications — a derived
// feed of platform events (auto-refreshed every 30 s while the tab is
// visible, plus a manual Refresh button). Charts/metrics land here later as
// additional views; the surface is built category-first so they slot in
// beside Notifications.

export default async function GlobalPerformancePage() {
  const result = await listNotifications("all");

  return (
    <PageContainer size="5xl">
      <PageHeader
        eyebrow="Overview · Performance"
        title="Global Monitor"
        description="Platform-wide activity, pulled on demand."
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
