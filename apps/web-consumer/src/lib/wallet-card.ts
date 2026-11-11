// Which server amount a Wallet card shows big (MESITA-3511). A choice of
// field, never arithmetic: Available when there is any; otherwise the
// Pending amount, tagged, so a guest who just bought a voucher never reads
// a bare $0 and never reads Pending as money they can spend now.

export type CardAmountInput = { available_cents: number; pending_cents: number };

export function cardAmount(b: CardAmountInput): { cents: number; pending: boolean } {
  if (b.available_cents <= 0 && b.pending_cents > 0) return { cents: b.pending_cents, pending: true };
  return { cents: Math.max(0, b.available_cents), pending: false };
}

// GIFT FROM THE WALLET (MESITA-3727): whether a Credits Card's Gift opens the
// Send to a friend sheet, explains why it cannot, or is hidden. Only money
// that can be spent now can be sent (spendable, the server's own limit,
// enforced again by consumer-web-send-credit). A card whose shown amount is
// above zero but has nothing spendable is waiting on pending or held credit.

export const GIFT_PENDING = "Credit becomes giftable once it's available";
export const GIFT_EMPTY = "Fund this card first to gift credit";

export type GiftAction = "open" | { blocked: string } | null;

/** null hides Gift (sending is off for this guest). */
export function giftAction(input: { canSend: boolean; spendableCents: number; shownCents: number }): GiftAction {
  if (!input.canSend) return null;
  if (input.spendableCents > 0) return "open";
  return { blocked: input.shownCents > 0 ? GIFT_PENDING : GIFT_EMPTY };
}
