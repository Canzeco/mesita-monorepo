// One money path for buying Pro (MESITA-4393): Me › Plan and the reserve
// flow's Pro step both start Checkout here, each with its own return URL
// (/me/plan, or the reserve page with ?pro=1). consumer-web-start-plan
// decides everything; this only maps its replies.

import type { SupabaseClient } from "@supabase/supabase-js";

import { EFError } from "@/lib/api/_invoke";
import { apiStartPlan } from "@/lib/api/plan";

/** The server's refusal codes, in the guest's words. */
export const REFUSED: Record<string, string> = {
  already_pro: "You're already on Pro.",
  not_subscribed: "You're not paying for Pro.",
  stripe_unavailable: "Payments are not available right now.",
};

/** A refusal's words, or `fallback` for anything else. */
export function refusal(err: unknown, fallback: string): string {
  if (err instanceof EFError && err.code && REFUSED[err.code])
    return REFUSED[err.code];
  return fallback;
}

export type UpgradeResult =
  /** Go to Stripe Checkout. */
  | { kind: "redirect"; url: string }
  /** A cancelled Pro was turned back on: nothing to pay. */
  | { kind: "resumed" }
  /** The guest is already on Pro (a stale read). */
  | { kind: "already_pro" }
  | { kind: "error"; message: string };

export async function startUpgrade(
  client: SupabaseClient,
  returnUrl: string,
): Promise<UpgradeResult> {
  try {
    const res = await apiStartPlan(client, returnUrl);
    if (res.url) return { kind: "redirect", url: res.url };
    return { kind: "resumed" };
  } catch (err) {
    if (err instanceof EFError && err.code === "already_pro")
      return { kind: "already_pro" };
    return {
      kind: "error",
      message: refusal(err, "Couldn't open checkout. Try again."),
    };
  }
}
