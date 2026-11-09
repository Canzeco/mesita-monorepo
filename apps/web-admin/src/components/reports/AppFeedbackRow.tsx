import type { AdminAppFeedback } from "@/components/reports/types";
import { formatAbsoluteUtc } from "@/lib/format";

// ONE GUEST'S APP FEEDBACK, read-only (MESITA-3029), drawn like ReportRow
// without the place line: the note, wrapped, never cut (at most 1,000
// characters), then who and when, muted. The note is plain text: React
// escapes it.

export function AppFeedbackRow({ feedback }: { feedback: AdminAppFeedback }) {
  const name = feedback.first_name ?? "Member";
  const who = feedback.member_number ? `${name} · Member ${feedback.member_number}` : name;
  return (
    <li className="border-border flex flex-col gap-1 border-t py-3 first:border-t-0 first:pt-0">
      <p className="text-sm leading-relaxed break-words whitespace-pre-line">{feedback.note}</p>
      <span className="text-muted-foreground text-xs">
        {who} · {formatAbsoluteUtc(feedback.created_at)}
      </span>
    </li>
  );
}
