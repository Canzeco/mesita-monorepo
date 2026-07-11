import {
  explainTicketBillPromo,
  formatPayMx,
  type TicketBillPayload,
} from "@/lib/api/pay";

export type TicketReceiptLine = {
  label: string;
  value: string;
  kind: "item" | "subtotal" | "deduction" | "total" | "note";
};

export type TicketReceiptView = {
  lines: TicketReceiptLine[];
  footerNote?: string;
};

export function buildTicketReceipt(
  p: TicketBillPayload,
  ticketKind?: string | null,
  opts?: { capMxn?: number | null },
): TicketReceiptView | null {
  const promo = explainTicketBillPromo(p, ticketKind, opts);
  if (!promo) return null;

  const fmt = (cents: number) => formatPayMx(cents, p.currency);
  const lines: TicketReceiptLine[] = [];

  if (promo.subtotalCents > 0) {
    lines.push({
      label: "Food & drinks",
      value: fmt(promo.subtotalCents),
      kind: "item",
    });
  }

  if (promo.tipCents > 0) {
    lines.push({
      label: "Tip",
      value: fmt(promo.tipCents),
      kind: "item",
    });
  }

  const hasFoodAndTip = promo.subtotalCents > 0 && promo.tipCents > 0;
  if (hasFoodAndTip) {
    lines.push({
      label: "Subtotal",
      value: fmt(promo.subtotalCents + promo.tipCents),
      kind: "subtotal",
    });
  }

  if (promo.computedPromoCents > 0) {
    const pct =
      promo.ratePercent != null && promo.ratePercent > 0
        ? `${promo.ratePercent}% off`
        : "Discount";
    lines.push({
      label: `Mesita ${pct}`,
      value: `− ${fmt(promo.computedPromoCents)}`,
      kind: "deduction",
    });
  }

  const totalCents =
    promo.amountDueCents != null ? promo.amountDueCents : promo.totalCents;

  lines.push({
    label: "You pay",
    value: fmt(totalCents),
    kind: "total",
  });

  const footerNote: string | undefined =
    "Confirm this matches what staff told you. Payment is the next step.";

  if (promo.capMxn != null && promo.capMxn > 0 && promo.ratePercent) {
    lines.push({
      label: `Discount applies to the first MX$${promo.capMxn.toLocaleString("en-US")} of food & drinks`,
      value: "",
      kind: "note",
    });
  }

  return { lines, footerNote };
}

/** @deprecated Use buildTicketReceipt */
export function buildTicketReceiptLines(
  p: TicketBillPayload,
  ticketKind?: string | null,
  opts?: { capMxn?: number | null },
): TicketReceiptLine[] | null {
  const view = buildTicketReceipt(p, ticketKind, opts);
  return view?.lines ?? null;
}
