// Me › Plan's three doors (MESITA-3870): read, Upgrade (Stripe Checkout, $2 a
// month), Cancel (stop renewing). The server decides everything; this file
// only calls it.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type GuestPlanView = {
  plan: "free" | "premium";
  /** Pro given by Mesita, not paid: no Cancel. */
  granted: boolean;
  cap: number;
  used: number;
  price_cents: number;
  currency: string;
  /** The end of the paid month (ISO), on a paid Pro. */
  paid_until: string | null;
  cancel_at_period_end: boolean;
  /** Checkout's return: "paid" once Stripe says so. */
  confirmed?: "paid" | "pending";
  /** The admin testing switch lifts every cap (MESITA-4393). Absent when
   *  the server could not read it, or before the EF carried it. */
  cap_lifted?: boolean;
  /** An operator set this guest's cap, so Pro would not change it. */
  cap_override?: boolean;
};

export async function apiGetPlan(
  client: SupabaseClient,
  sessionId?: string,
  opts: { light?: boolean } = {},
): Promise<GuestPlanView> {
  return await invokeEF<GuestPlanView>(client, "consumer-web-get-plan", {
    ...(sessionId ? { session_id: sessionId } : {}),
    // The reserve form's read skips the Stripe sync (MESITA-4393).
    ...(opts.light ? { light: true } : {}),
  });
}

/** Opens Checkout for Pro, or turns a cancelled Pro's renewal back on
 *  (`resumed`). A refusal throws an EFError with its `code`. */
export async function apiStartPlan(
  client: SupabaseClient,
  returnUrl: string,
): Promise<{ url?: string; resumed?: boolean }> {
  return await invokeEF<{ url?: string; resumed?: boolean }>(
    client,
    "consumer-web-start-plan",
    { return_url: returnUrl },
  );
}

export async function apiCancelPlan(
  client: SupabaseClient,
): Promise<{ paid_until: string | null }> {
  return await invokeEF<{ paid_until: string | null }>(
    client,
    "consumer-web-cancel-plan",
    {},
  );
}
