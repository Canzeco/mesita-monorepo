// Mock fixtures for business surfaces that aren't wired to real Edge
// Functions yet. The only page still reading from here is /unit/[id]/wallet
// — it renders behind a "Preview" banner so the placeholder nature is
// obvious to the operator.
//
// Trimmed to only the exports that page imports. When the wallet wires
// up to the real cashback_ledger + Stripe Connect payout flow, this file
// can be deleted entirely. Team data (business-list-team) and overview
// (business-get-overview) already moved to dedicated EFs.

// ── Wallet (wallet/page.tsx) ──────────────────────────────────────────────

type WalletSummary = {
  balance: number;
  thisMonth: number;
  lifetime: number;
  payoutAccount: string;
};

export const WALLET: WalletSummary = {
  balance: 142_300,
  thisMonth: 38_400,
  lifetime: 412_900,
  payoutAccount: "BBVA · ··· 4421",
};

type TransactionKind = "visit" | "payout" | "fee";

type Transaction = {
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
