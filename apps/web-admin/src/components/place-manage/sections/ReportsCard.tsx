"use client";

import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { listPlaceReports, type AdminPlace, type AdminPlaceReport } from "../actions";
import { SectionCard } from "@/components/admin-ui/manage";
import { formatAbsoluteUtc } from "@/lib/format";

// Reports — the place's guest reports (MESITA-2686), one card of rows,
// newest first. A guest reports a place from the three dots on its screen
// (MESITA-2684, consumer-web-report-place); one live report per guest, so a
// second report replaces the first. Read-only: nothing here resolves or
// clears a report.

/** The consumer sheet's labels for the place_reports.reason keys
 *  (apps/web-consumer/src/lib/api/reports.ts). */
const REASON_LABEL: Record<string, string> = {
  closed: "Permanently closed",
  wrong_info: "Wrong information",
  wrong_location: "Wrong location",
  inappropriate_photos: "Inappropriate photos",
  duplicate: "Duplicate place",
  other: "Something else",
};

function guestLine(r: AdminPlaceReport): string {
  const name = r.first_name ?? "Member";
  return r.member_number ? `${name} · Member ${r.member_number}` : name;
}

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
            <li
              key={r.consumer_id}
              className="border-border flex flex-col gap-1 border-t py-3 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-sm font-semibold">
                  {REASON_LABEL[r.reason] ?? r.reason}
                </span>
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {formatAbsoluteUtc(r.created_at)}
                </span>
              </div>
              {r.note ? (
                <p className="text-sm leading-relaxed break-words whitespace-pre-line">{r.note}</p>
              ) : null}
              <span className="text-muted-foreground text-xs">{guestLine(r)}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
