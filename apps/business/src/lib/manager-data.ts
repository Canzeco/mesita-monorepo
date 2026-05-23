// Mock fixtures for the manager surfaces that haven't been wired to real
// Edge Functions yet. Each consumer page renders behind a "Preview" banner
// so the data is honest about being placeholder.
//
// Trimmed to only the exports still imported by a page. Unused exports
// were removed in a cleanup pass — re-add when the surface that needs them
// gets built. Real persistence ships via dedicated `manager-*` Edge
// Functions (manager-list-team, manager-get-analytics, etc.) on the way
// in future migrations.

import type { Tier } from "./guest-data";

// ── Performance (performance/page.tsx) ────────────────────────────────────

export const FUNNEL = [
  { stage: "Profile views", value: 12_480 },
  { stage: "Swipes right", value: 4_320 },
  { stage: "Coupons claimed", value: 1_860 },
  { stage: "Visits", value: 612 },
  { stage: "Stories shared", value: 146 },
];

export type KpiTrend = "up" | "down";

export type Kpi = {
  label: string;
  value: string;
  delta: string;
  trend: KpiTrend;
};

export const ANALYTICS_KPIS: Kpi[] = [
  { label: "Profile views", value: "12.4k", delta: "+18%", trend: "up" },
  { label: "Influenced spend", value: "$84.2k", delta: "+22%", trend: "up" },
  { label: "Cashback paid", value: "$11.8k", delta: "+14%", trend: "up" },
  { label: "Gifts shared", value: "146", delta: "+31%", trend: "up" },
];

export const SECONDARY_METRICS: Kpi[] = [
  {
    label: "Average ticket",
    value: "$642",
    delta: "+9% vs last 30d",
    trend: "up",
  },
  { label: "Repeat rate", value: "38%", delta: "+6 pts", trend: "up" },
  { label: "ROAS", value: "7.1×", delta: "+0.8×", trend: "up" },
];

export type VerifiedStory = {
  handle: string;
  tier: Tier;
  ago: string;
  gradient: string;
};

export const VERIFIED_STORIES: VerifiedStory[] = [
  {
    handle: "@valenrose",
    tier: "gold",
    ago: "2h",
    gradient: "from-pink-300 via-rose-300 to-amber-200",
  },
  {
    handle: "@matgg",
    tier: "gold",
    ago: "5h",
    gradient: "from-fuchsia-300 via-pink-300 to-orange-200",
  },
  {
    handle: "@sof.ah",
    tier: "silver",
    ago: "1d",
    gradient: "from-rose-300 via-pink-200 to-yellow-100",
  },
  {
    handle: "@luispb",
    tier: "silver",
    ago: "1d",
    gradient: "from-pink-200 via-rose-200 to-amber-200",
  },
  {
    handle: "@anita",
    tier: "bronze",
    ago: "2d",
    gradient: "from-rose-200 via-pink-300 to-fuchsia-200",
  },
  {
    handle: "@noctura",
    tier: "gold",
    ago: "3d",
    gradient: "from-amber-200 via-pink-300 to-fuchsia-300",
  },
];

export type ValidatorFeedItem = {
  id: string;
  name: string;
  role: string;
  lastActive: string;
  status: "online" | "away" | "offline";
  validated: number;
  flagged: number;
  avatarBg: string;
};

export const VALIDATOR_FEED: ValidatorFeedItem[] = [
  {
    id: "vf-carlos",
    name: "Carlos",
    role: "Bar lead",
    lastActive: "2m",
    status: "online",
    validated: 18,
    flagged: 1,
    avatarBg: "bg-emerald-500",
  },
  {
    id: "vf-lucia",
    name: "Lucía",
    role: "Hostess",
    lastActive: "8m",
    status: "online",
    validated: 11,
    flagged: 0,
    avatarBg: "bg-pink-400",
  },
  {
    id: "vf-tono",
    name: "Toño",
    role: "Waiter",
    lastActive: "1h",
    status: "away",
    validated: 7,
    flagged: 2,
    avatarBg: "bg-orange-400",
  },
];

export type ValidatorThreadMessage = {
  id: string;
  side: "in" | "out";
  text: string;
  at: string;
  warning?: string;
};

export const VALIDATOR_THREAD: ValidatorThreadMessage[] = [
  {
    id: "m1",
    side: "in",
    text: "🌳 Mesa 7 · Valeria · $840 · 20% cashback",
    at: "20:12",
  },
  { id: "m2", side: "out", text: "OK validado", at: "20:12" },
  { id: "m3", side: "in", text: "Mesa 3 · Diego · $1,420 · 10%", at: "20:31" },
  { id: "m4", side: "out", text: "OK", at: "20:31" },
  {
    id: "m5",
    side: "in",
    text: "Mesa 11 · Sofía · $620 · 20%",
    at: "20:48",
    warning: "ticket sin propina",
  },
];

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

