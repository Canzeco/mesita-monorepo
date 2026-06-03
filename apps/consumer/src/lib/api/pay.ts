import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { ticketFlowTypeFromKind } from "@/lib/ticket-flow-steps";

export type PayNotificationRow =
  Database["public"]["Tables"]["consumer_pay_notifications"]["Row"];

/** Stored on consumer_pay_notifications.payload for Pay → Tickets. */
export type TicketBillPayload = {
  venue_id?: string;
  venue_slug?: string | null;
  venue_name?: string;
  venue_photo_url?: string | null;
  ticket_kind?: string;
  check_subtotal_cents?: number;
  tip_cents?: number;
  total_cents?: number;
  discount_cents?: number;
  discount_percent?: number | null;
  cashback_percent?: number | null;
  cashback_cents?: number | null;
  redeem_cents?: number;
  total_reward_cents?: number;
  /** Per-visit promo cap in major currency units (e.g. 500 MXN). */
  reward_cap_mxn?: number | null;
  monthly_promo_cap?: number | null;
  amount_due_cents?: number;
  currency?: string;
};

function formatBillScopeSuffix(
  capMxn: number | null | undefined,
  currency = "MXN",
): string {
  if (capMxn != null && capMxn > 0) {
    const prefix = currency === "MXN" ? "MX$" : "$";
    return `on the first ${prefix}${capMxn.toLocaleString("en-US")}`;
  }
  return "on the full bill";
}

export function formatTicketRewardLabel(
  p: TicketBillPayload,
  opts?: { capMxn?: number | null },
): string {
  const capMxn =
    opts?.capMxn ?? p.reward_cap_mxn ?? p.monthly_promo_cap ?? null;
  const billPart = formatBillScopeSuffix(capMxn, p.currency);

  if (p.discount_percent != null && p.discount_percent > 0) {
    return `${p.discount_percent}% Discount ${billPart}`;
  }
  if (p.cashback_percent != null && p.cashback_percent > 0) {
    return `${p.cashback_percent}% Cashback ${billPart}`;
  }

  const rewardCents =
    p.total_reward_cents ??
    (p.discount_cents ?? 0) + (p.redeem_cents ?? 0);
  if (rewardCents > 0) {
    return `${formatPayMx(rewardCents, p.currency)} ${billPart}`;
  }

  return `Pending ${billPart}`;
}

export function formatTicketVisitDate(
  iso: string | null | undefined,
): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatTicketVenueTitle(
  name: string | null | undefined,
  dateIso: string | null | undefined,
): string {
  const venue = name ?? "Partner venue";
  const date = formatTicketVisitDate(dateIso);
  return date ? `${venue} · ${date}` : venue;
}

export type TicketBillDisplayLine = {
  label: string;
  cents: number;
  emphasis?: boolean;
};

/** Bill + tip lines for ticket billing step (waiter enters both separately). */
export function ticketBillDisplayLines(
  p: TicketBillPayload,
): TicketBillDisplayLine[] {
  const lines: TicketBillDisplayLine[] = [];
  const hasSubtotal =
    p.check_subtotal_cents != null && p.check_subtotal_cents > 0;
  const hasTip = p.tip_cents != null && p.tip_cents > 0;
  const hasTotal = p.total_cents != null && p.total_cents > 0;

  if (hasSubtotal) {
    lines.push({ label: "Bill", cents: p.check_subtotal_cents! });
  }
  if (hasTip) {
    lines.push({ label: "Tip", cents: p.tip_cents! });
  }
  if (hasTotal) {
    if (hasSubtotal || hasTip) {
      lines.push({
        label: "Total",
        cents: p.total_cents!,
        emphasis: true,
      });
    } else {
      lines.push({ label: "Bill + tip", cents: p.total_cents! });
    }
  }

  return lines;
}

export type TicketBillPromoExplanation = {
  mechanic: "discount" | "cashback";
  ratePercent: number | null;
  /** Promo from ticket snapshot (discount_cents / cashback_cents). */
  promoCents: number;
  /** rate × eligible subtotal — used to show the formula. */
  computedPromoCents: number;
  redeemCents: number;
  subtotalCents: number;
  tipCents: number;
  totalCents: number;
  eligibleSubtotalCents: number;
  amountDueCents: number | null;
  capMxn: number | null;
};

export function explainTicketBillPromo(
  p: TicketBillPayload,
  ticketKind?: string | null,
  opts?: { capMxn?: number | null },
): TicketBillPromoExplanation | null {
  const subtotal = p.check_subtotal_cents ?? p.total_cents ?? 0;
  if (subtotal <= 0) return null;

  const flowType = ticketFlowTypeFromKind(ticketKind ?? p.ticket_kind ?? "dp");
  const mechanic = flowType === "C" || flowType === "D" ? "cashback" : "discount";
  const capMxn =
    opts?.capMxn ?? p.reward_cap_mxn ?? p.monthly_promo_cap ?? null;
  const capCents = capMxn != null && capMxn > 0 ? capMxn * 100 : null;
  const eligibleSubtotalCents =
    capCents != null ? Math.min(subtotal, capCents) : subtotal;

  const ratePercent =
    mechanic === "cashback"
      ? (p.cashback_percent ?? null)
      : (p.discount_percent ?? null);

  const promoCents =
    mechanic === "cashback"
      ? (p.cashback_cents ?? 0)
      : (p.discount_cents ?? 0);
  const computedPromoCents =
    ratePercent != null && ratePercent > 0
      ? Math.min(
          Math.floor((eligibleSubtotalCents * ratePercent) / 100),
          subtotal,
        )
      : promoCents;
  const displayPromoCents =
    ratePercent != null && ratePercent > 0 ? computedPromoCents : promoCents;

  const redeemCents = p.redeem_cents ?? 0;
  const tip = p.tip_cents ?? 0;
  const total = p.total_cents ?? subtotal + tip;

  const amountDueCents =
    p.amount_due_cents ??
    (mechanic === "discount"
      ? Math.max(0, subtotal - displayPromoCents - redeemCents)
      : tip > 0 || subtotal > 0
        ? Math.max(0, subtotal + tip - redeemCents)
        : null);

  return {
    mechanic,
    ratePercent,
    promoCents: displayPromoCents,
    computedPromoCents: displayPromoCents,
    redeemCents,
    subtotalCents: subtotal,
    tipCents: tip,
    totalCents: total,
    eligibleSubtotalCents,
    amountDueCents,
    capMxn,
  };
}

/** Natural-language billing summary for ticket detail — one paragraph. */
export function formatTicketBillSummaryText(
  p: TicketBillPayload,
  ticketKind?: string | null,
  opts?: { capMxn?: number | null },
): string | null {
  const promo = explainTicketBillPromo(p, ticketKind, opts);
  if (!promo) return null;

  const fmt = (cents: number) => formatPayMx(cents, p.currency);
  const parts: string[] = [];

  if (promo.mechanic === "discount") {
    parts.push(`Your subtotal is ${fmt(promo.subtotalCents)}.`);
    if (promo.ratePercent != null && promo.ratePercent > 0) {
      const capPhrase =
        promo.capMxn != null && promo.capMxn > 0
          ? ` on the first MX$${promo.capMxn.toLocaleString("en-US")} of food & drinks`
          : "";
      parts.push(
        `You get ${promo.ratePercent}% off the subtotal${capPhrase} — you save ${fmt(promo.computedPromoCents)}.`,
      );
    }
    if (promo.redeemCents > 0) {
      parts.push(
        `${fmt(promo.redeemCents)} from your Mesita balance was applied.`,
      );
    }
    if (promo.amountDueCents != null) {
      parts.push(`You pay ${fmt(promo.amountDueCents)} at the table.`);
    }
    return parts.join(" ");
  }

  const hasBreakdown =
    p.check_subtotal_cents != null &&
    p.check_subtotal_cents > 0 &&
    promo.tipCents > 0;

  if (hasBreakdown) {
    parts.push(
      `Your bill is ${fmt(promo.subtotalCents)} and your tip is ${fmt(promo.tipCents)} (${fmt(promo.totalCents)} total).`,
    );
  } else if (p.check_subtotal_cents != null && p.check_subtotal_cents > 0) {
    parts.push(`Your bill is ${fmt(promo.subtotalCents)}.`);
  } else {
    parts.push(`Bill total: ${fmt(promo.totalCents)}.`);
  }

  if (promo.ratePercent != null && promo.ratePercent > 0) {
    const capPhrase =
      promo.capMxn != null && promo.capMxn > 0
        ? ` on the first MX$${promo.capMxn.toLocaleString("en-US")} of food & drinks`
        : "";

    if (promo.mechanic === "cashback") {
      parts.push(
        `You earn ${promo.ratePercent}% cashback${capPhrase} on the bill — tip doesn't count. That's ${fmt(promo.computedPromoCents)} back to your Mesita balance.`,
      );
    } else {
      parts.push(
        `You get ${promo.ratePercent}% off the bill${capPhrase}. You save ${fmt(promo.computedPromoCents)}.`,
      );
    }
  }

  if (promo.redeemCents > 0) {
    parts.push(
      `${fmt(promo.redeemCents)} from your Mesita balance was applied.`,
    );
  }

  if (promo.amountDueCents != null) {
    parts.push(
      promo.mechanic === "cashback"
        ? `You pay ${fmt(promo.amountDueCents)} now; cashback lands after payment.`
        : `You pay ${fmt(promo.amountDueCents)} at the table.`,
    );
  }

  return parts.join(" ");
}

export type TicketTransactionSummary = {
  mechanic: "discount" | "cashback";
  promoPercent: number | null;
  promoVerb: "saved" | "won";
  paymentCents: number | null;
  rewardCents: number;
  rewardPercent: number | null;
  tipPercent: number | null;
  currency: string;
};

export function buildTicketTransactionSummary(
  p: TicketBillPayload,
  ticketKind?: string | null,
): TicketTransactionSummary | null {
  const total = p.total_cents ?? 0;
  if (total <= 0) return null;

  const flowType = ticketFlowTypeFromKind(ticketKind ?? p.ticket_kind ?? "dp");
  const mechanic = flowType === "C" || flowType === "D" ? "cashback" : "discount";
  const promoVerb = mechanic === "cashback" ? "won" : "saved";

  const promoPercent =
    mechanic === "cashback"
      ? (p.cashback_percent ?? null)
      : (p.discount_percent ?? null);

  const rewardCents =
    p.total_reward_cents ??
    (mechanic === "cashback"
      ? (p.cashback_cents ?? 0)
      : (p.discount_cents ?? 0)) + (p.redeem_cents ?? 0);

  const subtotal = p.check_subtotal_cents ?? total;
  const tip = p.tip_cents ?? 0;

  const paymentCents =
    p.amount_due_cents ??
    (mechanic === "discount"
      ? Math.max(
          0,
          subtotal - (p.discount_cents ?? 0) - (p.redeem_cents ?? 0),
        )
      : Math.max(
          0,
          subtotal - (p.discount_cents ?? 0) - (p.redeem_cents ?? 0) + tip,
        ));

  const rewardPercent =
    mechanic === "cashback" && rewardCents > 0 && subtotal > 0
      ? Math.round((rewardCents / subtotal) * 100)
      : null;

  const tipPercent =
    mechanic === "cashback" &&
    p.check_subtotal_cents != null &&
    p.check_subtotal_cents > 0 &&
    p.tip_cents != null &&
    p.tip_cents > 0
      ? Math.round((p.tip_cents / p.check_subtotal_cents) * 100)
      : null;

  const derivedPromoPercent =
    promoPercent ??
    (mechanic === "cashback" && p.cashback_cents && subtotal > 0
      ? Math.round((p.cashback_cents / subtotal) * 100)
      : p.discount_cents && subtotal > 0
        ? Math.round((p.discount_cents / subtotal) * 100)
        : null);

  return {
    mechanic,
    promoPercent: derivedPromoPercent,
    promoVerb,
    paymentCents,
    rewardCents,
    rewardPercent,
    tipPercent,
    currency: p.currency ?? "MXN",
  };
}

export function formatTicketTransactionSummaryLine(
  summary: TicketTransactionSummary,
): string {
  const parts: string[] = [];

  if (summary.mechanic === "discount") {
    if (summary.promoPercent != null && summary.promoPercent > 0) {
      parts.push(`${summary.promoPercent}% off subtotal`);
    }
    if (summary.paymentCents != null) {
      parts.push(`${formatPayMx(summary.paymentCents, summary.currency)} paid`);
    }
    return parts.length > 0 ? parts.join(" · ") : "Complete";
  }

  if (summary.promoPercent != null && summary.promoPercent > 0) {
    parts.push(`${summary.promoPercent}% ${summary.promoVerb}`);
  }

  if (summary.paymentCents != null) {
    parts.push(`${formatPayMx(summary.paymentCents, summary.currency)} paid`);
  }

  if (summary.rewardPercent != null && summary.rewardPercent > 0) {
    parts.push(`${summary.rewardPercent}% reward`);
  } else if (summary.rewardCents > 0) {
    parts.push(`${formatPayMx(summary.rewardCents, summary.currency)} reward`);
  }

  if (summary.tipPercent != null && summary.tipPercent > 0) {
    parts.push(`${summary.tipPercent}% tip`);
  }

  return parts.length > 0 ? parts.join(" · ") : "Complete";
}

export function formatPayMx(
  cents: number | undefined | null,
  currency = "MXN",
): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)} ${currency}`;
}

export function payloadFromNotification(
  payload: PayNotificationRow["payload"],
): TicketBillPayload {
  if (!payload || typeof payload !== "object") return {};
  return payload as TicketBillPayload;
}

export async function confirmTicketPayment(
  supabase: SupabaseClient<Database>,
  ticketId: string,
) {
  const { data, error } = await supabase.functions.invoke(
    "consumer-confirm-ticket-payment",
    { body: { ticketId } },
  );
  if (error) throw error;
  const body = data as { ok?: boolean; error?: string };
  if (!body?.ok) throw new Error(body?.error ?? "Could not confirm payment");
  return body;
}

export async function submitTicketReview(
  supabase: SupabaseClient<Database>,
  input: {
    ticketId: string;
    food: number;
    service: number;
    ambiance: number;
    overall: number;
    comments?: string;
  },
) {
  const { data, error } = await supabase.functions.invoke(
    "consumer-submit-ticket-review",
    { body: input },
  );
  if (error) throw error;
  const body = data as { ok?: boolean; error?: string };
  if (!body?.ok) throw new Error(body?.error ?? "Could not submit review");
  return body;
}
