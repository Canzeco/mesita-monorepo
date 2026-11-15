// ONE GIFT, ONE PAGE (MESITA-4066). The rules the gift page, the Gifts row
// and a gift line's credit page share, kept React-free so tests pin them:
//
//   giftOfEntry   a gift_out / gift_in / gift_back ledger line → its gift in
//                 the wallet's `gifts`, by the gift_id the server sends on
//                 the line. Never paired by amount or order (the credit page
//                 did that until MESITA-4066 and could swap two same-amount
//                 gifts).
//   giftState     the state word and tone: Waiting for a friend · Taken ·
//                 Taken · ready in 1 hr (the receiver's credit still on hold)
//                 · Taken back.

import type { GiftTicket, Wallet, WalletEntry } from "./api/wallet";

export const GIFT_KINDS = new Set(["gift_out", "gift_in", "gift_back"]);

export type GiftTone = "green" | "ink" | "grey";

/** The gift a ledger line belongs to, when the wallet read holds it. Null for
 *  a line that is not a gift's, a line from a server before MESITA-4066 (no
 *  gift_id) and a gift past the read's cap. */
export function giftOfEntry(wallet: Pick<Wallet, "gifts">, e: Pick<WalletEntry, "kind" | "gift_id">): GiftTicket | null {
  if (!GIFT_KINDS.has(e.kind) || !e.gift_id) return null;
  return wallet.gifts?.find((g) => g.gift_id === e.gift_id) ?? null;
}

/** One gift by its id, else null. */
export function findGift(wallet: Pick<Wallet, "gifts">, giftId: string): GiftTicket | null {
  return wallet.gifts?.find((g) => g.gift_id === giftId) ?? null;
}

const MIN = 60_000;
const HOUR = 60 * MIN;

/** How long until `iso`: "5 min", "1 hr", "3 days". */
export function readyIn(iso: string, nowMs: number = Date.now()): string {
  const left = Math.max(Date.parse(iso) - nowMs, 0);
  if (left < HOUR) return `${Math.max(Math.ceil(left / MIN), 1)} min`;
  if (left < 48 * HOUR) return `${Math.round(left / HOUR)} hr`;
  return `${Math.round(left / (24 * HOUR))} days`;
}

/** When the receiver's credit from this gift is still on hold, the moment it
 *  turns Available; else null. Only the receiver's own gift_in line says. */
export function giftHoldUntil(g: GiftTicket, nowMs: number = Date.now()): string | null {
  const at = g.entry?.kind === "gift_in" ? g.entry.available_at : null;
  return at && Date.parse(at) > nowMs ? at : null;
}

export function giftState(g: GiftTicket, nowMs: number = Date.now()): { label: string; tone: GiftTone } {
  if (g.status === "open") return { label: "Waiting for a friend", tone: "ink" };
  if (g.status === "taken_back") return { label: "Taken back", tone: "grey" };
  const hold = giftHoldUntil(g, nowMs);
  return hold
    ? { label: `Taken · ready in ${readyIn(hold, nowMs)}`, tone: "ink" }
    : { label: "Taken", tone: "green" };
}
