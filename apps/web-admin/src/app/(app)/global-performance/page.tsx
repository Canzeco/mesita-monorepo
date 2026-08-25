import { PageContainer, PageHeader } from "@/components/PageContainer";
import { ErrorNote } from "@/components/ErrorNote";
import { listNotifications } from "./actions";
import { GlobalPerformanceClient } from "./GlobalPerformanceClient";

export const dynamic = "force-dynamic";

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
        <div className="mt-6 sm:mt-8">
          <ErrorNote message={`Couldn't load notifications. ${result.error}`} />
        </div>
      )}
    </PageContainer>
  );
}
