// The arithmetic of admin-web-get-call-cost (MESITA-4043), pure so it is
// tested without ElevenLabs.

export type CallRow = { cost: number; seconds: number };

/** ElevenLabs list prices (USD a month, credits a month) — used only when the
 *  subscription read carries no invoice to divide. */
export const PLAN_LIST_PRICES: Record<string, { usd: number; credits: number }> = {
  starter: { usd: 5, credits: 30_000 },
  creator: { usd: 22, credits: 100_000 },
  pro: { usd: 99, credits: 500_000 },
  scale: { usd: 330, credits: 2_000_000 },
  business: { usd: 1320, credits: 11_000_000 },
};

export type CallCost = {
  calls: number;
  minutes: number;
  credits: number;
  creditsPerMinute: number | null;
  avgCallSeconds: number | null;
  usdPerCredit: number | null;
  usdPerMinute: number | null;
  /** Where usdPerCredit came from: the invoice, the tier's list price, or none. */
  priceSource: "invoice" | "list" | null;
};

/** Σ credits ÷ Σ minutes — a long call weighs more than a short one, which is
 *  what a minute costs on average. Calls with no duration are left out. */
export function callCost(
  rows: CallRow[],
  plan: { tier: string | null; creditLimit: number | null; invoiceUsd: number | null },
): CallCost {
  const used = rows.filter((r) => r.seconds > 0 && Number.isFinite(r.cost) && r.cost >= 0);
  const seconds = used.reduce((s, r) => s + r.seconds, 0);
  const credits = used.reduce((s, r) => s + r.cost, 0);
  const minutes = seconds / 60;

  let usdPerCredit: number | null = null;
  let priceSource: CallCost["priceSource"] = null;
  if (plan.invoiceUsd && plan.invoiceUsd > 0 && plan.creditLimit && plan.creditLimit > 0) {
    usdPerCredit = plan.invoiceUsd / plan.creditLimit;
    priceSource = "invoice";
  } else if (plan.tier && PLAN_LIST_PRICES[plan.tier.toLowerCase()]) {
    const p = PLAN_LIST_PRICES[plan.tier.toLowerCase()];
    usdPerCredit = p.usd / p.credits;
    priceSource = "list";
  }

  const creditsPerMinute = minutes > 0 ? credits / minutes : null;
  return {
    calls: used.length,
    minutes,
    credits,
    creditsPerMinute,
    avgCallSeconds: used.length > 0 ? seconds / used.length : null,
    usdPerCredit,
    usdPerMinute: creditsPerMinute != null && usdPerCredit != null ? creditsPerMinute * usdPerCredit : null,
    priceSource,
  };
}
