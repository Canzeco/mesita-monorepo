import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type PayNotificationRow =
  Database["public"]["Tables"]["consumer_pay_notifications"]["Row"];

/** Stored on consumer_pay_notifications.payload for Pay → Tickets. */
export type TicketBillPayload = {
  project_id?: string;
  place_slug?: string | null;
  place_name?: string;
  place_photo_url?: string | null;
  /** Bare handle (no @), from place instagram_url at billing time. */
  place_instagram_handle?: string | null;
  ticket_kind?: string;
  check_subtotal_cents?: number;
  tip_cents?: number;
  total_cents?: number;
  discount_cents?: number;
  discount_percent?: number | null;
  redeem_cents?: number;
  total_reward_cents?: number;
  /** Per-visit promo cap in major currency units (e.g. 500 MXN). */
  reward_cap_mxn?: number | null;
  monthly_promo_cap?: number | null;
  amount_due_cents?: number;
  currency?: string;
};

const MESITA_IG_HANDLE = "@mesita";

export function formatInstagramHandle(
  raw: string | null | undefined,
): string | null {
  const h = raw?.replace(/^@/, "").trim();
  return h ? `@${h}` : null;
}

export function instagramHandleFromUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const m = /instagram\.com\/([^/?#]+)/i.exec(url);
  if (!m) return null;
  const handle = m[1].replace(/^@/, "").trim();
  if (!handle) return null;
  const reserved = new Set(["p", "reel", "reels", "explore", "stories", "tv"]);
  if (reserved.has(handle.toLowerCase())) return null;
  return handle;
}

export function resolvePlaceInstagramHandle(
  payload: TicketBillPayload,
  fallbackUrl?: string | null,
): string | null {
  const fromPayload = payload.place_instagram_handle?.replace(/^@/, "").trim();
  if (fromPayload) return fromPayload;
  return instagramHandleFromUrl(fallbackUrl);
}

/** Story step: tag Mesita + the place's Instagram. */
export function storyTagInstruction(
  placeInstagramHandle: string | null | undefined,
): string {
  const place = formatInstagramHandle(placeInstagramHandle);
  if (place) {
    return `Tag ${MESITA_IG_HANDLE} and ${place} on your story.`;
  }
  return `Tag ${MESITA_IG_HANDLE} and the restaurant on your story.`;
}

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

  const rewardCents =
    p.total_reward_cents ?? (p.discount_cents ?? 0) + (p.redeem_cents ?? 0);
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

export function formatTicketPlaceTitle(
  name: string | null | undefined,
  dateIso: string | null | undefined,
): string {
  const place = name ?? "Partner place";
  const date = formatTicketVisitDate(dateIso);
  return date ? `${place} · ${date}` : place;
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
  ratePercent: number | null;
  /** Promo from ticket snapshot (discount_cents). */
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
  _ticketKind?: string | null,
  opts?: { capMxn?: number | null },
): TicketBillPromoExplanation | null {
  const subtotal = p.check_subtotal_cents ?? p.total_cents ?? 0;
  if (subtotal <= 0) return null;

  const capMxn =
    opts?.capMxn ?? p.reward_cap_mxn ?? p.monthly_promo_cap ?? null;
  const capCents = capMxn != null && capMxn > 0 ? capMxn * 100 : null;
  const eligibleSubtotalCents =
    capCents != null ? Math.min(subtotal, capCents) : subtotal;

  const ratePercent = p.discount_percent ?? null;

  const promoCents = p.discount_cents ?? 0;
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
    Math.max(0, subtotal - displayPromoCents - redeemCents);

  return {
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
  if (promo.amountDueCents != null) {
    parts.push(`You pay ${fmt(promo.amountDueCents)} at the table.`);
  }
  return parts.join(" ");
}

export type TicketTransactionSummary = {
  promoPercent: number | null;
  paymentCents: number | null;
  rewardCents: number;
  currency: string;
};

export function buildTicketTransactionSummary(
  p: TicketBillPayload,
  _ticketKind?: string | null,
): TicketTransactionSummary | null {
  const total = p.total_cents ?? 0;
  if (total <= 0) return null;

  const promoPercent = p.discount_percent ?? null;

  const rewardCents =
    p.total_reward_cents ?? (p.discount_cents ?? 0) + (p.redeem_cents ?? 0);

  const subtotal = p.check_subtotal_cents ?? total;

  const paymentCents =
    p.amount_due_cents ??
    Math.max(0, subtotal - (p.discount_cents ?? 0) - (p.redeem_cents ?? 0));

  const derivedPromoPercent =
    promoPercent ??
    (p.discount_cents && subtotal > 0
      ? Math.round((p.discount_cents / subtotal) * 100)
      : null);

  return {
    promoPercent: derivedPromoPercent,
    paymentCents,
    rewardCents,
    currency: p.currency ?? "MXN",
  };
}

export function formatTicketTransactionSummaryLine(
  summary: TicketTransactionSummary,
): string {
  const parts: string[] = [];

  if (summary.promoPercent != null && summary.promoPercent > 0) {
    parts.push(`${summary.promoPercent}% off subtotal`);
  }
  if (summary.paymentCents != null) {
    parts.push(`${formatPayMx(summary.paymentCents, summary.currency)} paid`);
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

/** Show mock story-detect control in ticket detail (dev / explicit flag). */
export const MOCK_STORY_DETECT_ENABLED =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_MOCK_STORY_DETECT === "true";

export async function mockStoryDetect(
  supabase: SupabaseClient<Database>,
  ticketId: string,
) {
  const { data, error } = await supabase.functions.invoke(
    "consumer-mock-story-detect",
    { body: { ticketId } },
  );
  if (error) throw error;
  const body = data as { ok?: boolean; error?: string };
  if (!body?.ok) {
    throw new Error(body?.error ?? "Could not simulate story detection.");
  }
  return body;
}

export async function submitTicketReview(
  supabase: SupabaseClient<Database>,
  input: {
    ticketId: string;
    food: number;
    service: number;
    ambiance: number;
    value: number;
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
