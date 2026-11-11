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

// The code (MESITA-3737): the same gift as the link, for reading aloud or
// writing on a card. Twelve random digits (10^12 codes: an 8-digit code is
// too easy to guess), shown 4-4-4, stored hashed, never reused.
export const GIFT_CODE_DIGITS = 12;
/** Wrong codes a guest may type in an hour. */
export const GIFT_CODE_MAX_MISSES = 5;

/** Twelve uniform digits from the platform CSPRNG (rejection sampling:
 *  bytes 250..255 are dropped so every digit is equally likely). */
export function mintGiftCode(): string {
  let out = "";
  while (out.length < GIFT_CODE_DIGITS) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < 250 && out.length < GIFT_CODE_DIGITS) out += String(b % 10);
    }
  }
  return out;
}

/** What a guest typed, as 12 digits: spaces and dashes are ignored. */
export function readGiftCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const digits = v.replace(/[\s-]/g, "");
  return /^\d{12}$/.test(digits) ? digits : null;
}

export async function hashGiftCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`gift-code:${code}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
