"use client";

import { useCallback, useState } from "react";
import { Heart, RefreshCw, Wrench } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { SectionCard } from "@/components/admin-ui/config";
import { Button } from "@/components/admin-ui/config";
import { GuestOpensCard } from "@/components/activity/GuestOpensCard";
import type { ActionResult } from "@/lib/action-result";
import type { ActivitySummary } from "@/lib/activity-summary-types";
import { getActivitySummary } from "@/lib/activity-summary";

export function AnalyticsClient({
  initial,
}: {
  initial: ActionResult<ActivitySummary>;
}) {
  const [summary, setSummary] = useState<ActivitySummary | null>(
    initial.ok ? initial : null,
  );
  const [error, setError] = useState<string | null>(initial.ok ? null : initial.error);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await getActivitySummary();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setSummary(result);
    } finally {
      setRefreshing(false);
    }
  }, []);

  if (!summary) {
    return error ? <ErrorNote message={error} /> : null;
  }

  const verbTiles = [
    { label: "Create", ...summary.operatorVerbs.create },
    { label: "Update", ...summary.operatorVerbs.update },
    { label: "Enrich", ...summary.operatorVerbs.enrich },
    { label: "Edit", ...summary.operatorVerbs.edit },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button
          tone="secondary"
          pending={refreshing}
          onClick={() => void refresh()}
          icon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Refresh
        </Button>
      </div>
      {error ? <ErrorNote message={error} /> : null}

      <GuestOpensCard
        windowDays={summary.windowDays}
        capped={summary.capped.guestOpens}
        summary={summary.guestOpens}
        names={summary.names}
      />

      <SectionCard
        icon={<Heart className="text-primary h-4 w-4" />}
        title="Social"
        subtitle="Platform-wide Viewed and Saved in the window."
      >
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="border-border rounded-xl border p-3">
            <dt className="text-muted-foreground type-meta">Members viewed</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {summary.guestSocial.viewedMembers}
            </dd>
          </div>
          <div className="border-border rounded-xl border p-3">
            <dt className="text-muted-foreground type-meta">Members saved</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {summary.guestSocial.savedMembers}
            </dd>
          </div>
          <div className="border-border rounded-xl border p-3">
            <dt className="text-muted-foreground type-meta">View events</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {summary.guestSocial.viewedEvents}
            </dd>
          </div>
          <div className="border-border rounded-xl border p-3">
            <dt className="text-muted-foreground type-meta">Save events</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {summary.guestSocial.savedEvents}
            </dd>
          </div>
        </dl>
        <p className="text-muted-foreground mt-4 text-sm">
          Per-place breakdowns stay on Manage › Single Place › Profile Stats.
        </p>
      </SectionCard>

      <SectionCard
        icon={<Wrench className="text-primary h-4 w-4" />}
        title="Operator actions"
        subtitle="Admin lifecycle verbs in the window."
      >
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {verbTiles.map((tile) => (
            <div key={tile.label} className="border-border rounded-xl border p-3">
              <dt className="text-muted-foreground type-meta">{tile.label}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{tile.succeeded}</dd>
              {tile.failed > 0 ? (
                <p className="text-muted-foreground type-meta mt-1">{tile.failed} failed</p>
              ) : null}
            </div>
          ))}
        </dl>
      </SectionCard>
    </div>
  );
}
