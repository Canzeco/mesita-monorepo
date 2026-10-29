import Link from "next/link";
import type { AdminPlaceReport } from "@/components/place-manage/actions";
import { formatAbsoluteUtc } from "@/lib/format";
import { reportReasonLabel } from "@/lib/report-reasons";

// ONE GUEST REPORT, read-only (MESITA-3024). Activity › Feedback and Single
// Place › Admin › Reports draw the same row:
//   line 1  the place (a link to its Admin tab, where Reports lives; left out
//           inside a place's own card) and the reason as a small chip
//   line 2  the note, wrapped, never cut (at most 500 characters)
//   line 3  who and when, muted
// The note is plain text: React escapes it.

function guestLine(r: AdminPlaceReport): string {
  const name = r.first_name ?? "Member";
  return r.member_number ? `${name} · Member ${r.member_number}` : name;
}

export function ReportRow({
  report,
  showPlace,
}: {
  report: AdminPlaceReport;
  showPlace: boolean;
}) {
  return (
    <li className="border-border flex flex-col gap-1 border-t py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {showPlace ? (
          <Link
            href={`/manage-single/${report.place_id}/admin`}
            className="focus-visible:ring-ring rounded text-sm font-semibold underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            {report.place_name}
          </Link>
        ) : null}
        <span className="bg-muted text-foreground rounded-full px-2 py-0.5 text-xs font-medium">
          {reportReasonLabel(report.reason)}
        </span>
      </div>
      {report.note ? (
        <p className="text-sm leading-relaxed break-words whitespace-pre-line">{report.note}</p>
      ) : null}
      <span className="text-muted-foreground text-xs">
        {guestLine(report)} · {formatAbsoluteUtc(report.created_at)}
      </span>
    </li>
  );
}
