"use client";

import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { listPlaceReports, type AdminPlace, type AdminPlaceReport } from "../actions";
import { SectionCard } from "@/components/admin-ui/manage";
import { ReportRow } from "@/components/reports/ReportRow";

// Reports — the place's guest reports (MESITA-2686), one card of rows,
// newest first. A guest reports a place from the three dots on its screen
// (MESITA-2684, consumer-web-report-place). Reports are append-only
// (MESITA-3024): a guest who sent two shows twice, so the count is sends,
// not guests. Every place's reports at once are Activity › Feedback.
// Read-only: nothing here resolves or clears a report.

export function ReportsCard({ place }: { place: AdminPlace }) {
  const [reports, setReports] = useState<AdminPlaceReport[] | null>(null);
  const [capped, setCapped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Every state update lands after the await (Next 16 lints a synchronous
    // setState in an effect body).
    let alive = true;
    void listPlaceReports(place.id).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      setReports(r.data.reports);
      setCapped(r.data.capped);
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  return (
    <SectionCard
      icon={<Flag className="h-4 w-4" />}
      tint="rose"
      title="Reports"
      subtitle={
        reports && reports.length > 0
          ? `${reports.length}${capped ? "+" : ""} from guests, newest first.`
          : "What guests reported from the three dots, newest first."
      }
    >
      {error ? (
        <p role="alert" className="text-destructive mt-3 text-sm">
          {error}
        </p>
      ) : !reports ? (
        <p className="text-muted-foreground mt-3 text-sm">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">No guest has reported this place.</p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {reports.map((r) => (
            <ReportRow key={r.id} report={r} showPlace={false} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
