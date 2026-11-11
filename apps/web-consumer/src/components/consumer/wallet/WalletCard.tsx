import { money } from "@/lib/api/wallet";

// A PLACE'S CREDITS CARD, AS DATA (MESITA-3511's House Card). Since
// MESITA-3741 nothing draws the payment-card face: the Wallet lists a card as
// a row (WalletLists' CreditsRow) and its page shows the amounts as a plain
// card (PlaceCredit). The amount is the server's, chosen by `cardAmount`.

export type WalletCardModel = {
  key: string;
  name: string;
  photo: string | null;
  /** From the place's catalog row; absent = no mark (the server decides). */
  tier: number | null;
  currency: string;
  available_cents: number;
  pending_cents: number;
  /** A balance row exists for this card (a $0 catalog card has none). */
  hasBalance: boolean;
  /** Tap: expand the history, open the place, or nothing. */
  tap: { kind: "expand" } | { kind: "link"; href: string } | { kind: "open" } | { kind: "plain" };
};

export function walletCardLabel(card: WalletCardModel): string {
  if (!card.hasBalance) return `${card.name}: no credits, open place`;
  const pending = card.pending_cents > 0 ? `, ${money(card.pending_cents, card.currency)} pending` : "";
  return `${card.name}: ${money(card.available_cents, card.currency)} in credits${pending}`;
}
