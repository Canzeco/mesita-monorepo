"use client";

import {
  explainTicketBillPromo,
  formatPayMx,
  type TicketBillPayload,
} from "@/lib/api/pay";

/** Large amount block for bill / pay steps. */
export function TicketAmountDueCard({
  payload,
  ticketKind,
  capMxn,
}: {
  payload: TicketBillPayload;
  ticketKind?: string | null;
  capMxn?: number | null;
}) {
  const promo = explainTicketBillPromo(payload, ticketKind, { capMxn });
  if (!promo?.amountDueCents) return null;

  const label =
    promo.mechanic === "discount" ? "You pay at the table" : "You pay now";

  return (
    <div className="border-border/60 bg-muted/25 rounded-2xl border px-4 py-3 text-center">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-foreground mt-1 text-3xl font-bold tabular-nums tracking-tight">
        {formatPayMx(promo.amountDueCents, payload.currency)}
      </p>
      {promo.mechanic === "discount" && promo.computedPromoCents > 0 ? (
        <p className="text-secondary mt-1 text-sm font-medium">
          Includes {formatPayMx(promo.computedPromoCents, payload.currency)} off
        </p>
      ) : null}
    </div>
  );
}
