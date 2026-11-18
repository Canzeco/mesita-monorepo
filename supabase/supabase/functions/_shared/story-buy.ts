// The Story buy's own gate (MESITA-4296): the guest names the story they were
// shown (consumer-web-check-story) and the buy re-checks it on the server
// before any charge. Every refusal means nothing was charged and the sheet
// goes back to "Check my story".
//
//   400 bad_body field=mention_id   no story named
//   409 story_one_per_basket        a Story is paid alone, one unit
//   409 story_not_found             no such story (or it was swept)
//   409 story_taken                 another guest's, already claimed, or already
//                                   paid by this guest
//   409 story_too_old               it would end before the re-check
//   409 story_livemode              a test story on a live purchase, or back
//   409 story_not_verified          no waiter of this place approved it
//                                   (MESITA-4304)
//   409 story_payment_in_progress   this guest's earlier payment for this same
//                                   story is still in flight at Stripe
//
// An earlier payment of the same guest for the same story that never finished
// is settled first (settlePurchaseByPaymentIntent, forced past its wait):
// cancelled at Stripe → released, and the new buy goes on; succeeded meanwhile
// → credited, and this buy is story_taken.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isUuid } from "./place-id.ts";
import { LIVE_RESERVATION_EXCLUDES, MENTION_COLUMNS, mentionFits, type MentionRow, type StoryRulesLive } from "./story-mention.ts";
import { PURCHASE_PI_TTL_MS, purchaseStore, settlePurchaseByPaymentIntent } from "./purchase-pi.ts";
import type { StripeCall } from "./stripe.ts";
import type { MoneyCode } from "./money-codes.ts";

export type StoryBuyRefusal = { status: number; code: MoneyCode | "bad_body"; error: string; field?: string };

const REFUSE = {
  basket: { status: 409, code: "story_one_per_basket", error: "The Story voucher is paid on its own" },
  missing: { status: 400, code: "bad_body", field: "mention_id", error: "Show your story first" },
  notFound: { status: 409, code: "story_not_found", error: "We couldn't find that story any more. Check again" },
  taken: { status: 409, code: "story_taken", error: "That story is already used. Post a new one" },
  tooOld: { status: 409, code: "story_too_old", error: "Your story must stay up 3 more hours. Post a new one" },
  livemode: { status: 409, code: "story_livemode", error: "That story can't be used for this payment" },
  notVerified: { status: 409, code: "story_not_verified", error: "Show your story to the waiter first" },
  inFlight: { status: 409, code: "story_payment_in_progress", error: "Your payment with this story is still going through" },
} as const satisfies Record<string, StoryBuyRefusal>;

/** A Story basket: exactly one Story and nothing else. Null when the basket
 *  has no Story or is a Story alone. */
export function storyBasketRefusal(kinds: readonly string[], units: number): StoryBuyRefusal | null {
  if (!kinds.includes("voucher_story")) return null;
  return kinds.length === 1 && units === 1 ? null : REFUSE.basket;
}

/** Pure: the named mention against this guest and this purchase. */
export function storyMentionRefusal(
  m: Pick<MentionRow, "ig_handle" | "purchase_id" | "livemode" | "mentioned_at" | "review" | "review_place_id"> | null,
  guestHandle: string | null,
  placeId: string,
  livemode: boolean,
  nowMs: number,
  rules: Pick<StoryRulesLive, "bonusWaitSec" | "creditMarginSec">,
): StoryBuyRefusal | null {
  if (!m) return REFUSE.notFound;
  if (!guestHandle || m.ig_handle !== guestHandle.toLowerCase()) return REFUSE.notFound;
  if (m.purchase_id) return REFUSE.taken;
  if (m.livemode !== livemode) return REFUSE.livemode;
  if (!mentionFits(m, livemode, nowMs, rules, rules.creditMarginSec)) return REFUSE.tooOld;
  if (m.review !== "approved" || m.review_place_id !== placeId) return REFUSE.notVerified;
  return null;
}

type Holder = {
  id: string;
  consumer_id: string | null;
  status: string;
  stripe_account_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
};

/** The whole server-side gate. Returns the mention id to reserve, or why not. */
export async function storyBuyGate(
  admin: SupabaseClient,
  stripe: () => StripeCall | null,
  args: { consumerId: string; placeId: string; mentionId: unknown; guestHandle: string | null; livemode: boolean; rules: StoryRulesLive; nowMs: number },
): Promise<{ ok: true; mentionId: string } | { ok: false; refusal: StoryBuyRefusal }> {
  if (!isUuid(args.mentionId)) return { ok: false, refusal: REFUSE.missing };
  const { data, error } = await admin.from("story_mentions").select(MENTION_COLUMNS).eq("id", args.mentionId).maybeSingle();
  if (error) throw new Error(`story_mentions: ${error.message}`);
  const refused = storyMentionRefusal(data as MentionRow | null, args.guestHandle, args.placeId, args.livemode, args.nowMs, args.rules);
  if (refused) return { ok: false, refusal: refused };

  // Who already holds it live (wallet_purchases_story_mention_live_idx).
  const { data: held, error: heldErr } = await admin.from("wallet_purchases")
    .select("id, consumer_id, status, stripe_account_id, stripe_payment_intent_id, created_at")
    .eq("story_mention_id", args.mentionId)
    .not("status", "in", `(${LIVE_RESERVATION_EXCLUDES.join(",")})`);
  if (heldErr) throw new Error(`wallet_purchases: ${heldErr.message}`);
  for (const h of (held ?? []) as Holder[]) {
    if (h.consumer_id !== args.consumerId || !["opening", "open"].includes(h.status)) return { ok: false, refusal: REFUSE.taken };
    // This guest's own earlier try with the same story.
    const call = stripe();
    if (!h.stripe_payment_intent_id || !h.stripe_account_id || !call) {
      // No PaymentIntent yet: the first tap is still writing it.
      if (args.nowMs - Date.parse(h.created_at) < 2 * 60_000) return { ok: false, refusal: REFUSE.inFlight };
      const { error: failErr } = await admin.from("wallet_purchases")
        .update({ status: "failed", stripe_error: "story_retry", updated_at: new Date().toISOString() })
        .eq("id", h.id).eq("status", h.status).is("stripe_payment_intent_id", null);
      if (failErr) throw new Error(`purchase_release: ${failErr.message}`);
      continue;
    }
    const outcome = await settlePurchaseByPaymentIntent(purchaseStore(admin), call, {
      id: h.id,
      stripe_account_id: h.stripe_account_id,
      stripe_payment_intent_id: h.stripe_payment_intent_id,
      created_at: h.created_at,
      available_at: null,
    }, args.nowMs + PURCHASE_PI_TTL_MS);
    if (outcome === "credited" || outcome === "already_paid") return { ok: false, refusal: REFUSE.taken };
    if (outcome !== "expired") return { ok: false, refusal: REFUSE.inFlight };
  }
  return { ok: true, mentionId: args.mentionId };
}

/** The unique-index violation that means another tap reserved it first. */
export function isStoryTakenConflict(err: { code?: string; message?: string } | null | undefined): boolean {
  return err?.code === "23505" && (err.message ?? "").includes("wallet_purchases_story_mention_live_idx");
}

export const STORY_TAKEN = REFUSE.taken;
