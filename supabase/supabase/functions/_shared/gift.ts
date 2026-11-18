// Sending credit to a friend (MESITA-3292).
//
// A guest picks an amount of their spendable credit at one place; the
// credit leaves their balance at once and they get a one-time link
// (<consumer origin>/wallet/gift/<token>). A signed-in friend who opens it
// takes the credit at the same place; until then the sender can take it
// back. The token is a proof-shaped 128-bit token and gates money, so it is
// stored hashed (like the waiter's charge token, MESITA-3306): the sender
// sees the link once, and a lost link is taken back and sent again.

import { isProofToken } from "./proof.ts";
import { isUuid } from "./place-id.ts";
import { MAX_PAYMENT_INPUT_CENTS } from "./money.ts";
import type { MoneyCode } from "./money-codes.ts";

/** At most this many open links per (sender, place). */
export const GIFT_MAX_OPEN = 10;

/** A link's key since MESITA-4390 (Pato: "random 6 chars alphanumeric …
 *  the link must only be mesita.ai/g/abcdef"): 6 characters [A-Za-z0-9],
 *  unbiased from the CSPRNG. 62^6 ≈ 57 billion keys; wallet_send_credit
 *  refuses one any gift ever had (code_taken) and the EF draws again, and
 *  wrong keys are capped (GIFT_MISS_CAP), so guessing one is hopeless. */
export const GIFT_CODE_LENGTH = 6;
const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export function mintGiftToken(): string {
  let out = "";
  while (out.length < GIFT_CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      // 248 = 62 × 4: bytes at or above it would bias the draw.
      if (b < 248 && out.length < GIFT_CODE_LENGTH) out += CODE_ALPHABET[b % 62];
    }
  }
  return out;
}

const SHORT_CODE = /^[A-Za-z0-9]{6}$/;
/** A link's key: a short code (MESITA-4390) or a 22-character key sent
 *  before it (MESITA-3292), which keep working. */
export function isGiftToken(v: unknown): v is string {
  return isProofToken(v) || (typeof v === "string" && SHORT_CODE.test(v));
}

/** How many tries the EF makes when a drawn key is taken. */
export const GIFT_CODE_DRAWS = 5;

/** Wrong keys allowed per hour (MESITA-4390): per signed-in guest (look and
 *  claim), and for the public preview as a whole. */
export const GIFT_MISS_CAP = { guest: 10, preview: 300 } as const;

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

// ─── The wrong-key cap (MESITA-4390) ────────────────────────────────
type GuardClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

/** Is the bucket under its cap? A failed read lets the lookup through: the
 *  cap guards guessing, it never blocks a real link on a database blip. */
export async function giftGuardOpen(admin: GuardClient, bucket: string, max: number): Promise<boolean> {
  const { data, error } = await admin.rpc("wallet_gift_link_guard", { p_bucket: bucket, p_max: max, p_miss: false });
  if (error) {
    console.error("[gift] guard read:", error.message);
    return true;
  }
  return data !== false;
}

/** Record one wrong key in the bucket. Best effort. */
export async function giftGuardMiss(admin: GuardClient, bucket: string): Promise<void> {
  const { error } = await admin.rpc("wallet_gift_link_guard", { p_bucket: bucket, p_max: 0, p_miss: true });
  if (error) console.error("[gift] guard miss:", error.message);
}
