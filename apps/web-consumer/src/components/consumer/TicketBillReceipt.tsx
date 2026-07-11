"use client";

import {
  buildTicketReceipt,
  type TicketReceiptLine,
} from "@/lib/ticket-bill-receipt";
import type { TicketBillPayload } from "@/lib/api/pay";
import { cn } from "@/lib/utils";

export function TicketBillReceipt({
  payload,
  ticketKind,
  capMxn,
  placeName,
}: {
  payload: TicketBillPayload;
  ticketKind?: string | null;
  capMxn?: number | null;
  placeName?: string | null;
}) {
  const receipt = buildTicketReceipt(payload, ticketKind, { capMxn });
  if (!receipt?.lines.length) return null;

  const itemLines = receipt.lines.filter(
    (l) => l.kind === "item" || l.kind === "subtotal" || l.kind === "deduction",
  );
  const totalLine = receipt.lines.find((l) => l.kind === "total");
  const noteLines = receipt.lines.filter((l) => l.kind === "note");

  return (
    <div className="border-border/80 bg-card overflow-hidden rounded-2xl border shadow-sm">
      <div className="border-border/60 bg-muted/20 border-b px-4 py-3">
        <p className="text-foreground text-base leading-tight font-semibold">
          {placeName ?? "Your bill"}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          What you owe at the restaurant
        </p>
      </div>

      <div className="px-4 py-4">
        {itemLines.length > 0 ? (
          <div className="space-y-2.5">
            <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
              Charges
            </p>
            {itemLines.map((line, i) => (
              <ReceiptRow key={`${line.label}-${i}`} line={line} />
            ))}
          </div>
        ) : null}

        {totalLine ? (
          <div
            className={cn(
              "mt-4 flex items-center justify-between gap-4 rounded-xl px-4 py-3",
              "bg-foreground text-background",
            )}
          >
            <span className="text-sm font-semibold">{totalLine.label}</span>
            <span className="text-xl font-bold tracking-tight tabular-nums">
              {totalLine.value}
            </span>
          </div>
        ) : null}

        {noteLines.map((line, i) => (
          <p
            key={`note-${i}`}
            className="text-muted-foreground mt-3 text-xs leading-snug"
          >
            {line.label}
          </p>
        ))}
      </div>

      {receipt.footerNote ? (
        <div className="border-border/60 bg-muted/15 border-t px-4 py-3">
          <p className="text-muted-foreground text-center text-xs leading-snug">
            {receipt.footerNote}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ReceiptRow({ line }: { line: TicketReceiptLine }) {
  const isDeduction = line.kind === "deduction";
  const isSubtotal = line.kind === "subtotal";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        isSubtotal && "border-border/60 border-t border-dashed pt-2",
      )}
    >
      <span
        className={cn(
          "text-sm",
          isDeduction ? "text-secondary font-medium" : "text-foreground",
          isSubtotal && "text-muted-foreground font-medium",
        )}
      >
        {line.label}
      </span>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          isDeduction && "text-secondary",
          isSubtotal && "text-foreground",
          line.kind === "item" && "text-foreground",
        )}
      >
        {line.value}
      </span>
    </div>
  );
}
