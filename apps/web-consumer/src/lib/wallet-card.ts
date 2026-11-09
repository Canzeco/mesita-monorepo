// Which server amount a Wallet card shows big (MESITA-3511). A choice of
// field, never arithmetic: Available when there is any; otherwise the
// Pending amount, tagged, so a guest who just bought a voucher never reads
// a bare $0 and never reads Pending as money they can spend now.

export type CardAmountInput = { available_cents: number; pending_cents: number };

export function cardAmount(b: CardAmountInput): { cents: number; pending: boolean } {
  if (b.available_cents <= 0 && b.pending_cents > 0) return { cents: b.pending_cents, pending: true };
  return { cents: Math.max(0, b.available_cents), pending: false };
}
