import { MousePointerClick } from "lucide-react";
import { SectionCard } from "@/components/admin-ui/config";
import type { ActivitySummary } from "@/lib/activity-summary-types";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function GuestOpensCard({
  windowDays,
  capped,
  summary,
  names,
}: {
  windowDays: number;
  capped: boolean;
  summary: ActivitySummary["guestOpens"];
  names: Record<string, string>;
}) {
  const stats = [
    { label: "Opens", value: String(summary.opens) },
    { label: "Places", value: String(summary.places) },
    { label: "Created", value: String(summary.byOutcome.created) },
    { label: "Already on Mesita", value: String(summary.byOutcome.existing) },
    { label: "Refused", value: String(summary.byOutcome.refused) },
    { label: "Failed", value: String(summary.byOutcome.failed) },
    { label: "Ended on a profile", value: summary.opens > 0 ? pct(summary.profileRate) : "—" },
  ];
  return (
    <SectionCard
      icon={<MousePointerClick className="text-primary h-4 w-4" />}
      title="Opens from Google"
      subtitle="Every time a guest opened a Google-only place, and how it ended."
    >
      <div className="mt-4 flex flex-col gap-4">
        <p className="text-muted-foreground type-meta">
          Last {windowDays} days{capped ? ", newest rows only" : ""}.
        </p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="border-border rounded-xl border p-3">
              <dt className="text-muted-foreground type-meta">{stat.label}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="text-muted-foreground type-meta mb-2 font-semibold">
            Opened more than once
          </p>
          {summary.repeated.length === 0 ? (
            <p className="text-sm">No place has been opened twice yet.</p>
          ) : (
            <ul className="border-border divide-border divide-y rounded-xl border">
              {summary.repeated.map((row) => (
                <li
                  key={row.googlePlaceId}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {names[row.googlePlaceId] ?? row.googlePlaceId}
                  </span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {row.opens} opens{row.created ? " · created here" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
