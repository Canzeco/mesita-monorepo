"use client";

import { BarChart3 } from "lucide-react";
import type { AdminVenue } from "../actions";
import { SectionCard } from "../ui";

// Mirrors the business app's performance page — an analytics placeholder until
// the metrics pipeline lands. Kept so the nav + venue context are consistent.
export function PerformanceSection({ venue }: { venue: AdminVenue }) {
  return (
    <SectionCard
      icon={<BarChart3 className="text-muted-foreground h-4 w-4" />}
      title="Performance"
      subtitle={`Analytics for ${venue.name}.`}
    >
      <div className="border-border bg-background mt-5 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center">
        <div className="bg-card text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
          <BarChart3 className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium">Stats coming soon</p>
        <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
          Daily visits, retention, and revenue-by-tier charts will show up here
          once the analytics pipeline lands — shared with the business console.
        </p>
      </div>
    </SectionCard>
  );
}
