"use client";

import {
  formatTicketBillSummaryText,
  formatTicketRewardLabel,
  type TicketBillPayload,
} from "@/lib/api/pay";

export function TicketBillSummary({
  payload,
  capMxn,
  ticketKind,
}: {
  payload: TicketBillPayload;
  capMxn?: number | null;
  ticketKind?: string | null;
}) {
  const summary = formatTicketBillSummaryText(payload, ticketKind, {
    capMxn,
  });

  return (
    <p className="text-muted-foreground text-[13px] leading-relaxed">
      {summary ?? formatTicketRewardLabel(payload, { capMxn })}
    </p>
  );
}
