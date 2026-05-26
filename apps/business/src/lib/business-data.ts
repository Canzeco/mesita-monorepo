// Mock fixtures for the business surfaces that haven't been wired to real
// Edge Functions yet. Each consumer page renders behind a "Preview" banner
// so the data is honest about being placeholder.
//
// Trimmed to only the exports still imported by a page. Unused exports
// were removed in a cleanup pass — re-add when the surface that needs them
// gets built. Real persistence ships via dedicated `business-*` Edge
// Functions (business-list-team, business-get-analytics, etc.) on the way
// in future migrations.

// ── Wallet (wallet/page.tsx) ──────────────────────────────────────────────

export type WalletSummary = {
  balance: number;
  pendingPayout: number;
  thisMonth: number;
  lifetime: number;
  payoutAccount: string;
  stripeConnected: boolean;
};

export const WALLET: WalletSummary = {
  balance: 142_300,
  pendingPayout: 38_400,
  thisMonth: 38_400,
  lifetime: 412_900,
  payoutAccount: "BBVA · ··· 4421",
  stripeConnected: true,
};

export type TransactionKind = "visit" | "payout" | "fee";

export type Transaction = {
  id: string;
  kind: TransactionKind;
  label: string;
  amount: number;
  cashback: number;
  when: string;
};

export const TRANSACTIONS: Transaction[] = [
  {
    id: "t-1",
    kind: "visit",
    label: "Visit · Valentina R.",
    amount: 1840,
    cashback: -276,
    when: "2h ago",
  },
  {
    id: "t-2",
    kind: "visit",
    label: "Visit · Lucas M.",
    amount: 920,
    cashback: -138,
    when: "4h ago",
  },
  {
    id: "t-3",
    kind: "payout",
    label: "Payout · BBVA ··· 4421",
    amount: -24_500,
    cashback: 0,
    when: "Yesterday",
  },
  {
    id: "t-4",
    kind: "visit",
    label: "Visit · Renata G.",
    amount: 640,
    cashback: -64,
    when: "Yesterday",
  },
  {
    id: "t-5",
    kind: "fee",
    label: "Mesita commission · May",
    amount: -2_400,
    cashback: 0,
    when: "3 days ago",
  },
  {
    id: "t-6",
    kind: "payout",
    label: "Payout · BBVA ··· 4421",
    amount: -52_000,
    cashback: 0,
    when: "1 week ago",
  },
];
