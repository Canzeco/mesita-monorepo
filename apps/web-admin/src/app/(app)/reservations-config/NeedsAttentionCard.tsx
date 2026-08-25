"use client";

import { AlertTriangle } from "lucide-react";
import { SectionCard } from "@/components/admin-ui/config";
import type { NeedsAttentionRow } from "./catalog";

function whyAttention(row: NeedsAttentionRow): string {
  if (row.notice_state === "failed") {
    return row.notice_kind === "venue_cancel"
      ? "Place never told the table was cancelled"
      : "Guest never told the table was cancelled";
  }
  if (row.attempts_state === "error") return "Booking run died";
  if (row.callback_state === "failed") return "Guest call could not be placed";
  if (row.reminder_state === "failed") return "Reminder call could not be placed";
  return "Place confirmed, guest never picked up";
}

export function NeedsAttentionCard({ rows }: { rows: NeedsAttentionRow[] }) {
  if (rows.length === 0) return null;
  return (
    <SectionCard
      icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
      title={`Needs attention (${rows.length})`}
      subtitle="These do not fix themselves."
    >
      <ul className="mt-5 space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="border-border bg-card flex flex-col gap-1 rounded-2xl border p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold tabular-nums">
                #{row.reference_code ?? row.id.slice(0, 8)}
              </span>
              <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 type-meta font-semibold text-red-700">
                {row.status}
              </span>
              {row.is_test && (
                <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 type-meta font-medium">
                  test
                </span>
              )}
              <span className="text-muted-foreground text-xs">
                {new Date(row.reserved_at).toLocaleString()}
              </span>
            </div>
            <p className="text-xs font-medium text-red-700">{whyAttention(row)}</p>
            {row.last_call_status && (
              <p className="text-muted-foreground text-xs">{row.last_call_status}</p>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
