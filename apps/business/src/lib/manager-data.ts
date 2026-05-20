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

export const ANALYTICS_KPIS = [
  {
    label: "Profile views",
    value: "12.4k",
    delta: "+18%",
    trend: "up" as const,
  },
  {
    label: "Influenced spend",
    value: "$84.2k",
    delta: "+22%",
    trend: "up" as const,
  },
  {
    label: "Cashback paid",
    value: "$11.8k",
    delta: "+14%",
    trend: "up" as const,
  },
  { label: "Gifts shared", value: "146", delta: "+31%", trend: "up" as const },
];

export const SECONDARY_METRICS = [
  {
    label: "Average ticket",
    value: "$642",
    delta: "+9% vs last 30d",
    trend: "up" as const,
  },
  { label: "Repeat rate", value: "38%", delta: "+6 pts", trend: "up" as const },
  { label: "ROAS", value: "7.1×", delta: "+0.8×", trend: "up" as const },
];

export const VERIFIED_STORIES: {
  handle: string;
  tier: Tier;
  ago: string;
  gradient: string;
}[] = [
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

export const VALIDATOR_FEED: {
  id: string;
  name: string;
  role: string;
  lastActive: string;
  status: "online" | "away" | "offline";
  validated: number;
  flagged: number;
  avatarBg: string;
}[] = [
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

export const VALIDATOR_THREAD: {
  id: string;
  side: "in" | "out";
  text: string;
  at: string;
  warning?: string;
}[] = [
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

export const WALLET = {
  balance: 142_300,
  pendingPayout: 38_400,
  thisMonth: 38_400,
  lifetime: 412_900,
  payoutAccount: "BBVA · ··· 4421",
  stripeConnected: true,
};

export const TRANSACTIONS = [
  {
    id: "t-1",
    kind: "visit" as const,
    label: "Visit · Valentina R.",
    amount: 1840,
    cashback: -276,
    when: "2h ago",
  },
  {
    id: "t-2",
    kind: "visit" as const,
    label: "Visit · Lucas M.",
    amount: 920,
    cashback: -138,
    when: "4h ago",
  },
  {
    id: "t-3",
    kind: "payout" as const,
    label: "Payout · BBVA ··· 4421",
    amount: -24_500,
    cashback: 0,
    when: "Yesterday",
  },
  {
    id: "t-4",
    kind: "visit" as const,
    label: "Visit · Renata G.",
    amount: 640,
    cashback: -64,
    when: "Yesterday",
  },
  {
    id: "t-5",
    kind: "fee" as const,
    label: "Mesita commission · May",
    amount: -2_400,
    cashback: 0,
    when: "3 days ago",
  },
  {
    id: "t-6",
    kind: "payout" as const,
    label: "Payout · BBVA ··· 4421",
    amount: -52_000,
    cashback: 0,
    when: "1 week ago",
  },
];

// ── Team (team/page.tsx) ──────────────────────────────────────────────────

export const TEAM = [
  {
    id: "m-1",
    name: "Iván Solís",
    role: "Owner",
    access: "full" as const,
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80&auto=format&fit=crop&crop=faces",
    lastActive: "Now",
  },
  {
    id: "m-2",
    name: "Marta R.",
    role: "Manager",
    access: "full" as const,
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80&auto=format&fit=crop&crop=faces",
    lastActive: "1h ago",
  },
];

export const VALIDATORS = [
  {
    id: "w-1",
    name: "Carlos M.",
    role: "Waiter",
    phone: "+52 81 1234 5678",
    lastActive: "Now",
  },
  {
    id: "w-2",
    name: "Lucía P.",
    role: "Waiter",
    phone: "+52 81 9876 5432",
    lastActive: "2h ago",
  },
  {
    id: "w-3",
    name: "Diego A.",
    role: "Host",
    phone: "+52 81 5555 1212",
    lastActive: "Yesterday",
  },
];
