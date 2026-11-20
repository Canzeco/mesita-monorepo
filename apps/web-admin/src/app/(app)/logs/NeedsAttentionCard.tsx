"use client";

import { AlertTriangle } from "lucide-react";
import { Chip, SectionCard } from "@/components/admin-ui";
import type { NeedsAttentionRow } from "../reservations-config/catalog";

function whyAttention(row: NeedsAttentionRow): string {
  if (row.notice_state === "failed") {
    return row.notice_kind === "place_cancel"
      ? "Place never told the table was cancelled"
      : "Guest never told the table was cancelled";
  }
  if (row.attempts_state === "error") return "Booking run died";
  if (row.callback_state === "failed") return "Guest call could not be placed";
  if (row.reminder_state === "failed")
    return "Reminder call could not be placed";
  return "Place confirmed, guest never picked up";
}

export function NeedsAttentionCard({
  rows,
  error = null,
  more = false,
}: {
  rows: NeedsAttentionRow[];
  error?: string | null;
  more?: boolean;
}) {
  if (!error && rows.length === 0) return null;
  return (
    <SectionCard
      icon={<AlertTriangle />}
      title={error ? "Reservations that need attention" : `Reservations that need attention (${rows.length})`}
      subtitle={
        error
          ? "The list could not be read. This is not an empty list."
          : more
            ? "These do not fix themselves. Showing the 30 newest. Older failures are not listed."
            : "These do not fix themselves."
      }
    >
      {error && <p className="text-destructive mt-4 text-sm">{error}</p>}
      <ul className="mt-5 space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="border-border bg-card flex flex-col gap-1 rounded-xl border p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold tabular-nums">
                #{row.reference_code ?? row.id.slice(0, 8)}
              </span>
              <Chip tone="danger">{row.state}</Chip>
              {row.is_test && <Chip>test</Chip>}
              <span className="text-muted-foreground text-xs">
                {new Date(row.reserved_at).toLocaleString()}
              </span>
            </div>
            <p className="text-destructive text-xs font-medium">
              {whyAttention(row)}
            </p>
            {row.last_call_state && (
              <p className="text-muted-foreground text-xs">
                {row.last_call_state}
              </p>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
