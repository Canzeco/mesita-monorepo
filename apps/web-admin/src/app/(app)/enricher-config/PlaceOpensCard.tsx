import { MousePointerClick } from "lucide-react";
import { SectionCard } from "@/components/admin-ui/config";
import type { ActionResult } from "@/lib/action-result";
import type { PlaceOpensReport } from "./actions";

// Configurations › Creation: how guests' Google-only opens end (MESITA-2323).
// Every tap that opens a Google-only card or gray pin runs get-or-create;
// this counts them by outcome and lists the places opened more than once.
// Read-only.

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function PlaceOpensCard({ report }: { report: ActionResult<PlaceOpensReport> }) {
  return (
    <SectionCard
      icon={<MousePointerClick className="text-primary h-4 w-4" />}
      title="Opens from Google"
      subtitle="Every time a guest opened a Google-only place, and how it ended."
    >
      {!report.ok ? (
        <p className="text-destructive mt-4 text-sm" role="alert">
          {report.error}
        </p>
      ) : (
        <OpensBody report={report} />
      )}
    </SectionCard>
  );
}

function OpensBody({ report }: { report: PlaceOpensReport }) {
  const s = report.summary;
  const stats = [
    { label: "Opens", value: String(s.opens) },
    { label: "Places", value: String(s.places) },
    { label: "Created", value: String(s.byOutcome.created) },
    { label: "Already on Mesita", value: String(s.byOutcome.existing) },
    { label: "Refused", value: String(s.byOutcome.refused) },
    { label: "Failed", value: String(s.byOutcome.failed) },
    { label: "Ended on a profile", value: s.opens > 0 ? pct(s.profileRate) : "—" },
  ];
  return (
    <div className="mt-4 flex flex-col gap-4">
      <p className="text-muted-foreground type-meta">
        Last {report.windowDays} days{report.capped ? ", newest rows only" : ""}.
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
        {s.repeated.length === 0 ? (
          <p className="text-sm">No place has been opened twice yet.</p>
        ) : (
          <ul className="border-border divide-border divide-y rounded-xl border">
            {s.repeated.map((row) => (
              <li
                key={row.googlePlaceId}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  {report.names[row.googlePlaceId] ?? row.googlePlaceId}
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
  );
}
