import { AlertTriangle } from "lucide-react";
import { listNotifications } from "./actions";
import { GlobalPerformanceClient } from "./GlobalPerformanceClient";

export const dynamic = "force-dynamic";

// Global Performance console. The first view is Notifications — a derived,
// non-realtime feed of platform events (the operator pulls fresh data with
// the Refresh button). Charts/metrics land here later as additional views;
// the surface is built category-first so they slot in beside Notifications.

export default async function GlobalPerformancePage() {
  const result = await listNotifications("all");

  return (
    <div className="mx-auto max-w-5xl px-8 pt-12 pb-14">
      <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
        Overview · Performance
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        Global Performance
      </h1>
      <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
        Platform-wide activity, pulled on demand. Notifications surface the
        moments that matter — new venues, Atlas enrichments, and ownership
        claims — newest first.
      </p>

      {result.ok ? (
        <GlobalPerformanceClient initial={result.data} />
      ) : (
        <div className="border-destructive/40 bg-destructive/5 text-destructive mt-8 flex items-start gap-3 rounded-2xl border p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Couldn&apos;t load notifications.</p>
            <p className="mt-1 opacity-90">{result.error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
