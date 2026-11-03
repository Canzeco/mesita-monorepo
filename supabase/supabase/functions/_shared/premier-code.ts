// Premier codes (MESITA-3167): a 100% code redeems Premier Refill days. The
// body behind consumer-web-redeem-premier-code, business-web-redeem-premier-code
// and admin-web-create-premier-code.
//
// A code is 8 characters of Crockford base32 (no I, L, O, U), shown
// XXXX-XXXX and typed in any case, with or without the dash; I and L read as
// 1, O as 0. The database never sees the plain code: it stores
// HMAC-SHA256(code, PREMIER_CODE_PEPPER) and the last 4 characters. Without
// the secret every code door answers 503 codes_off.
//
// Redemption is premier_redeem_code (rate limit, code checks, the days
// through premier_add_days, the use counted, all in one transaction). A
// refusal is HTTP 200 { ok: false, code, error[, retry_after] }, the Premier
// convention.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json } from "./http.ts";

export const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_LENGTH = 8;

type ReadEnv = (name: string) => string | undefined;
const envRead: ReadEnv = (name) => Deno.env.get(name);

/** The HMAC secret, or null when it is not set. */
export function codePepper(read: ReadEnv = envRead): string | null {
  const v = (read("PREMIER_CODE_PEPPER") ?? "").trim();
  return v === "" ? null : v;
}

export function codesOff(): Response {
  return json({ ok: false, code: "codes_off", error: "Codes aren't available right now." }, 503);
}

/** The code as stored for hashing (8 Crockford characters), or null when the
 *  input cannot be one. Pure. */
export function normalizeCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.toUpperCase().replace(/[\s-]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0");
  if (s.length !== CODE_LENGTH) return null;
  for (const ch of s) if (!CROCKFORD.includes(ch)) return null;
  return s;
}

/** XXXX-XXXX. Pure. */
export function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** A new random code (40 bits of entropy, unbiased: 256 % 32 = 0). */
export function mintCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return Array.from(random(CODE_LENGTH), (b) => CROCKFORD[b % 32]).join("");
}

/** HMAC-SHA256(code, pepper) as 64 hex characters. */
export async function hashCode(code: string, pepper: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(code)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** What premier_redeem_code answers. */
export type RedeemResult =
  | {
    result: "ok";
    tier: 1 | 2;
    days: number;
    ends_at_2x: string | null;
    ends_at_5x: string | null;
    paused_tier: 1 | 2 | null;
    paused_until: string | null;
  }
  | { result: "refused"; code: string; retry_after?: string };

/** The plain words for a refusal (the server's `code`); the screens may say
 *  it in their own voice. */
export const REDEEM_REFUSED: Record<string, string> = {
  code_unknown: "That code doesn't exist.",
  code_expired: "That code has expired.",
  code_exhausted: "That code has been used up.",
  code_used_here: "This code was already used on this place.",
  paid_higher: "A 5X subscription already ranks this place higher. The code was not used.",
  rate_limited: "Too many tries. Try again later.",
  cap_reached: "This place already has a year of days queued.",
  not_found: "This place can't take Premier days.",
  archived: "This place can't take Premier days.",
  unlisted: "This place can't take Premier days.",
};

/** The EF reply for a redemption result. Pure. */
export function redeemReply(r: RedeemResult): Response {
  if (r.result === "refused") {
    return json({
      ok: false,
      code: r.code,
      error: REDEEM_REFUSED[r.code] ?? "That code can't be used here.",
      ...(r.retry_after ? { retry_after: r.retry_after } : {}),
    });
  }
  return json({
    ok: true,
    tier: r.tier,
    days: r.days,
    ends_at: r.tier === 2 ? r.ends_at_5x : r.ends_at_2x,
    ends_at_2x: r.ends_at_2x,
    ends_at_5x: r.ends_at_5x,
    paused: r.paused_tier && r.paused_until ? { tier: r.paused_tier, until: r.paused_until } : null,
  });
}

/** Redeems `rawCode` on a place for a user: the whole door after auth. */
export async function redeemPremierCode(
  admin: SupabaseClient,
  input: { rawCode: unknown; placeId: string; userId: string },
  source: string,
  pepper: string | null = codePepper(),
): Promise<Response> {
  if (!pepper) return codesOff();
  // A string that cannot be a code is unknown without a database round trip;
  // only well-formed tries count toward the limit.
  const code = normalizeCode(input.rawCode);
  if (!code) return redeemReply({ result: "refused", code: "code_unknown" });
  const hash = await hashCode(code, pepper);
  const { data, error } = await admin.rpc("premier_redeem_code", {
    p_code_hash: hash,
    p_place_id: input.placeId,
    p_user_id: input.userId,
  });
  if (error) {
    const requestId = crypto.randomUUID();
    console.error(`[${source}] premier_redeem_code`, requestId, error.message);
    return json({ ok: false, error: "Couldn't check the code. Try again.", request_id: requestId }, 500);
  }
  const r = data as RedeemResult;
  console.log(JSON.stringify({
    fn: source,
    place: input.placeId,
    code: code.slice(-4),
    result: r.result,
    ...(r.result === "refused" ? { refusal: r.code } : { tier: r.tier, days: r.days }),
  }));
  return redeemReply(r);
}

export type CreateCode = { tier: 1 | 2; days: number; maxRedemptions: number; expiresAt: string | null };

/** admin-web-create-premier-code's create body, checked. Pure. */
export function parseCreateCode(
  body: Record<string, unknown>,
  now: number,
): CreateCode | { code: string; error: string } {
  const { tier, days, maxRedemptions, expiresAt } = body;
  if (tier !== 1 && tier !== 2) return { code: "tier_invalid", error: "tier must be 1 (2X) or 2 (5X)" };
  if (!Number.isInteger(days) || (days as number) < 1 || (days as number) > 366) {
    return { code: "days_invalid", error: "days must be 1 to 366" };
  }
  if (!Number.isInteger(maxRedemptions) || (maxRedemptions as number) < 1 || (maxRedemptions as number) > 100000) {
    return { code: "max_invalid", error: "maxRedemptions must be 1 to 100000" };
  }
  let expires: string | null = null;
  if (expiresAt != null && expiresAt !== "") {
    const t = typeof expiresAt === "string" ? Date.parse(expiresAt) : NaN;
    if (!Number.isFinite(t) || t <= now) return { code: "expires_invalid", error: "expiresAt must be a date in the future" };
    expires = new Date(t).toISOString();
  }
  return { tier, days: days as number, maxRedemptions: maxRedemptions as number, expiresAt: expires };
}
