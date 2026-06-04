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
  /** Cashback only — shown below the total, not mixed into the math. */
  rewardCallout?: string;
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

  if (promo.mechanic === "discount" && promo.computedPromoCents > 0) {
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

  if (promo.redeemCents > 0) {
    lines.push({
      label: "Balance used",
      value: `− ${fmt(promo.redeemCents)}`,
      kind: "deduction",
    });
  }

  const totalCents =
    promo.mechanic === "discount" && promo.amountDueCents != null
      ? promo.amountDueCents
      : promo.totalCents;

  lines.push({
    label: promo.mechanic === "discount" ? "You pay" : "Total to pay",
    value: fmt(totalCents),
    kind: "total",
  });

  let rewardCallout: string | undefined;
  if (promo.mechanic === "cashback" && promo.computedPromoCents > 0) {
    const pct =
      promo.ratePercent != null && promo.ratePercent > 0
        ? `${promo.ratePercent}% `
        : "";
    rewardCallout = `After you pay, ${pct}cashback of ${fmt(promo.computedPromoCents)} goes to your Mesita balance. Tip is not included in cashback.`;
  }

  let footerNote: string | undefined =
    "Confirm this matches what staff told you. Payment is the next step.";

  if (promo.capMxn != null && promo.capMxn > 0 && promo.ratePercent) {
    lines.push({
      label: `Cashback/discount applies to the first MX$${promo.capMxn.toLocaleString("en-US")} of food & drinks`,
      value: "",
      kind: "note",
    });
  }

  return { lines, rewardCallout, footerNote };
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
