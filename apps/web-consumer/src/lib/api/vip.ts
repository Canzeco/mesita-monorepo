// BECOME VIP WITH A CODE (MESITA-4766): consumer-web-redeem-vip-code. The
// server checks the code, counts tries and makes the guest VIP; this only
// sends the twelve digits and names the answer. During the deploy window
// the function itself can 404 with no code: that reads as `failed`, the
// generic "Couldn't check the code".

import type { SupabaseClient } from "@supabase/supabase-js";
import { EFError, invokeEF } from "./_invoke";

export type RedeemVipResult =
  | { kind: "joined" }
  | { kind: "already_vip" }
  | { kind: "code_invalid" }
  | { kind: "invalid_code_format" }
  | { kind: "too_many_tries"; retryAfterSeconds: number | null }
  | { kind: "consumer_not_found" }
  | { kind: "failed" };

/** One answer (or thrown failure) of the redeem function, named. Exported
 *  for the tests: it is the whole contract. */
export function redeemVipResult(outcome: unknown, err?: unknown): RedeemVipResult {
  if (err === undefined) {
    if (outcome === "joined") return { kind: "joined" };
    if (outcome === "already_vip") return { kind: "already_vip" };
    return { kind: "failed" };
  }
  const code = err instanceof EFError ? err.code : null;
  if (code === "code_invalid") return { kind: "code_invalid" };
  if (code === "invalid_code_format") return { kind: "invalid_code_format" };
  if (code === "consumer_not_found") return { kind: "consumer_not_found" };
  if (code === "too_many_tries") {
    const after = err instanceof EFError ? err.body?.retryAfterSeconds : null;
    return { kind: "too_many_tries", retryAfterSeconds: typeof after === "number" ? after : null };
  }
  return { kind: "failed" };
}

/** Redeem an invitation code: `code` is the twelve digits as a string. Never
 *  throws: every failure is a named result. */
export async function apiRedeemVipCode(client: SupabaseClient, code: string): Promise<RedeemVipResult> {
  try {
    const r = await invokeEF<{ outcome: string }>(client, "consumer-web-redeem-vip-code", { code }, "Couldn't check the code");
    return redeemVipResult(r.outcome);
  } catch (err) {
    return redeemVipResult(null, err);
  }
}
