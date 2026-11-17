"use client";

import { PayPage } from "../pay/PayPage";

// THE WALLET IS PAY'S LOWER HALF (Pato, 2026-11-16, MESITA-4199: "merge pay
// and wallet into one page ... call that page Pay"): /wallet/gift/<token>
// draws Pay with the friend's credit sheet over it. It was its own bar tab
// (MESITA-3722, MESITA-3886) until this.
export function WalletPage({
  giftToken = null,
}: {
  giftToken?: string | null;
}) {
  return <PayPage giftToken={giftToken} />;
}
