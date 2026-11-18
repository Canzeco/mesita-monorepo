// Sending credit to a friend (MESITA-3292).
//
// A guest picks an amount of their spendable credit at one place; the
// credit leaves their balance at once and they get a one-time link
// (<consumer origin>/wallet/gift/<token>). A signed-in friend who opens it
// takes the credit at the same place; until then the sender can take it
// back. The token is a proof-shaped 128-bit token and gates money, so it is
// stored hashed (like the waiter's charge token, MESITA-3306): the sender
// sees the link once, and a lost link is taken back and sent again.

import { isProofToken, mintProofToken } from "./proof.ts";
import { isUuid } from "./place-id.ts";
import { MAX_PAYMENT_INPUT_CENTS } from "./money.ts";
import type { MoneyCode } from "./money-codes.ts";

/** At most this many open links per (sender, place). */
export const GIFT_MAX_OPEN = 10;

export const mintGiftToken = mintProofToken;
export const isGiftToken = isProofToken;

// A gift is a link only (MESITA-4223): MESITA-3737's 12-digit code is no
// longer minted or accepted. wallet_gifts.code_hash and
// wallet_claim_gift_code stay in the database, unused.

export async function hashGiftToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`gift-token:${token}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type SendInput = { placeId: string; amountCents: number; requestId: string };
export type Refusal = { ok: false; status: number; code?: MoneyCode; error: string };

/** The send body: a place, a whole number of cents within one payment's
 *  cap, and one request id per tap. */
export function readSendBody(b: Record<string, unknown>): { ok: true; input: SendInput } | Refusal {
  if (!isUuid(b.place_id)) {
    return { ok: false, status: 400, error: "place_id must be a Mesita place id" };
  }
  if (!isUuid(b.request_id)) {
    return { ok: false, status: 400, error: "request_id must be a uuid" };
  }
  const a = b.amount_cents;
  if (typeof a !== "number" || !Number.isInteger(a) || a <= 0) {
    return { ok: false, status: 400, code: "amount_required", error: "Type an amount to send" };
  }
  if (a > MAX_PAYMENT_INPUT_CENTS) {
    return { ok: false, status: 400, code: "above_cap", error: "That's more than one link can carry" };
  }
  return { ok: true, input: { placeId: b.place_id, amountCents: a, requestId: b.request_id } };
}

/** The HTTP status for each refusal the gift RPCs answer. */
export function giftRefusalStatus(code: string | undefined): number {
  switch (code) {
    case "gone":
      return 404;
    case "too_many_tries":
      return 429;
    case "insufficient":
    case "taken":
    case "too_many_open":
    case "own_gift":
    case "claimed":
    case "taken_back":
      return 409;
    case "amount_required":
      return 400;
    default:
      return 500;
  }
}

// ─── The link's public preview (MESITA-4229) ────────────────────────
// A signed-out friend who taps a gift link lands on sign-in with
// `?next=/wallet/gift/<token>`; consumer-web-get-gift-preview lets that page
// (and its link card) say "$200.00MX of credit at Orinoco". An OPEN or a
// CLAIMED link of this payments mode answers, with its state, amount and
// currency: never who took it, or any id. A claimed link answers so its card
// can say "Claimed" (Pato, 2026-11-18, MESITA-4367: "if the gift gets
// claimed, that preview must change"). A taken-back link, an unknown key and
// the other mode are one "gone".

export type GiftRow = {
  id?: string;
  place_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  livemode: boolean;
  sender_id?: string | null;
  recipient_id?: string | null;
};

export type GiftPreview = { status: "open" | "claimed"; amount_cents: number; currency: string };

/** What a link may show before sign-in, or null when it shows nothing. */
export function giftPreview(row: GiftRow | null, livemode: boolean): GiftPreview | null {
  if (!row || row.livemode !== livemode) return null;
  if (row.status !== "open" && row.status !== "claimed") return null;
  return { status: row.status, amount_cents: row.amount_cents, currency: row.currency };
}
