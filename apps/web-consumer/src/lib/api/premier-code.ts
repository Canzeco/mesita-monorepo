// Premier codes (MESITA-3167): a 100% code adds Premier Refill days (2X or
// 5X) to a place; nothing is charged. The guest redeems it on the place's
// Premier tab. Every date here is the server's.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type RedeemedCode = {
  tier: 1 | 2;
  days: number;
  ends_at: string | null;
  paused: { tier: 1 | 2; until: string } | null;
};

/** What a refused code means, on the guest's tab (Design D5; the server's `code`). */
export const CODE_REFUSED: Record<string, string> = {
  code_unknown: "That code doesn't exist.",
  code_expired: "That code has expired.",
  code_exhausted: "That code has been used up.",
  code_used_here: "This code was already used on this place.",
  paid_higher:
    "A 5X subscription already ranks this place higher. The code was not used.",
  cap_reached: "This place already has a year of days queued.",
  not_found: "This place can't take a Boost.",
  archived: "This place can't take a Boost.",
  unlisted: "This place can't take a Boost.",
  codes_off: "Codes aren't available right now.",
};

/** "Too many tries. Try again at 4:05 PM." */
export function rateLimitedLine(retryAfter: unknown): string {
  const t = typeof retryAfter === "string" ? new Date(retryAfter) : null;
  if (!t || Number.isNaN(t.getTime()))
    return "Too many tries. Try again later.";
  return `Too many tries. Try again at ${t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`;
}

/** Redeems a code on a place. A refusal throws an EFError whose `code` is a
 *  CODE_REFUSED key or `rate_limited` (its body carries `retry_after`). */
export async function apiRedeemPremierCode(
  client: SupabaseClient,
  placeId: string,
  code: string,
): Promise<RedeemedCode> {
  return await invokeEF<RedeemedCode>(
    client,
    "consumer-web-redeem-premier-code",
    {
      place_id: placeId,
      code,
    },
  );
}
