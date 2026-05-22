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
//
// Shape mirrors Stripe Connect Express: amounts in centavos (cents); balance
// is split into available_cents (withdrawable now) vs pending_cents (held by
// Mesita platform until story validates or dispute window closes). Each
// charge is held on Mesita's platform balance via Separate Charges and
// Transfers, not auto-routed to the venue's Stripe account — which is why a
// "pending" amount has a release reason and an ETA. Real ledger lives in
// Postgres; Stripe is the rail.

export type StripeConnectStatus =
  // Venue has never started Connect onboarding.
  | "not_connected"
  // Started Stripe-hosted onboarding but didn't finish.
  | "onboarding_pending"
  // Submitted, Stripe is reviewing KYB / bank details.
  | "verification_pending"
  // Verified, payouts enabled.
  | "active"
  // Active but Stripe has paused payouts (e.g. flagged for review).
  | "restricted";

export type WalletSummary = {
  connectStatus: StripeConnectStatus;
  // All amounts in MXN centavos.
  availableCents: number;
  pendingCents: number;
  // Net of platform fees (Stripe + Mesita) for the current month.
  thisMonthNetCents: number;
  lifetimePayoutsCents: number;
  // Schedule controls how often Mesita auto-releases to the venue's bank.
  payoutSchedule: "manual" | "daily" | "weekly";
  payoutDestination: string;
  // Instant payouts (Stripe Connect Instant Payouts) carry a 1.5% fee and
  // require an eligible debit card on file. Show as a secondary action only
  // when this is non-zero.
  instantAvailableCents: number;
};

export const WALLET: WalletSummary = {
  connectStatus: "active",
  availableCents: 104_200_00,
  pendingCents: 38_140_00,
  thisMonthNetCents: 162_400_00,
  lifetimePayoutsCents: 1_247_800_00,
  payoutSchedule: "weekly",
  payoutDestination: "BBVA · ···4421",
  instantAvailableCents: 104_200_00,
};

// Cashback or venue cut held on Mesita's platform balance until a real-world
// condition is met. Once met, an internal job promotes the entry from
// pending → available and triggers the Stripe Transfer to the venue's
// Express account (or stays parked for closed-loop guest balance).
export type PendingReleaseReason =
  // Follower-path Silver/Gold/Diamond guest hasn't posted their IG story
  // yet, or the waiter hasn't validated the screenshot.
  | "story_pending"
  // 7-day chargeback risk window before releasing venue's portion.
  | "dispute_window"
  // Stripe Radar flagged the underlying charge for manual review.
  | "stripe_review";

export type PendingRelease = {
  id: string;
  amountCents: number;
  reason: PendingReleaseReason;
  releasesIn: string;
  ticketLabel: string;
};

export const PENDING_RELEASES: PendingRelease[] = [
  {
    id: "pr-1",
    amountCents: 12_600_00,
    reason: "story_pending",
    releasesIn: "when @valentina_r's story validates",
    ticketLabel: "Valentina R · MX$1,840",
  },
  {
    id: "pr-2",
    amountCents: 8_400_00,
    reason: "dispute_window",
    releasesIn: "in 4 days",
    ticketLabel: "Lucas M · MX$920",
  },
  {
    id: "pr-3",
    amountCents: 14_740_00,
    reason: "story_pending",
    releasesIn: "when @diegoarq's story validates",
    ticketLabel: "Diego A · MX$2,400",
  },
  {
    id: "pr-4",
    amountCents: 2_400_00,
    reason: "stripe_review",
    releasesIn: "under Stripe review · ~24h",
    ticketLabel: "Renata G · MX$640",
  },
];

// Stripe Connect transaction taxonomy. `charge` = guest paid a bill;
// `transfer` = Mesita moved funds from platform → Express account; `payout`
// = Express account → bank account; `fee` = Mesita's monthly platform fee
// debited from the venue; `refund` / `adjustment` cover edge cases.
export type StripeTxnType =
  | "charge"
  | "refund"
  | "transfer"
  | "payout"
  | "fee"
  | "adjustment";

// Mirrors Stripe BalanceTransaction.status semantics, simplified for the
// manager view. `pending` = still in holdback window. `available` = ready to
// be transferred out. `in_transit` = payout dispatched, not yet settled at
// bank. `paid` = settled. `refunded` / `failed` are terminal error states.
export type StripeTxnStatus =
  | "pending"
  | "available"
  | "in_transit"
  | "paid"
  | "refunded"
  | "failed";

export type Transaction = {
  id: string;
  type: StripeTxnType;
  label: string;
  // Signed: positive = inflow to venue balance, negative = outflow.
  grossCents: number;
  // Always ≤ 0 (Stripe processing fee + Mesita platform fee combined). Zero
  // for payouts / transfers where no fee applies at this leg.
  feeCents: number;
  // Convenience pre-computed as gross + fee.
  netCents: number;
  status: StripeTxnStatus;
  // ch_..., tr_..., po_..., re_... — surfaced for support / reconciliation.
  stripeObjectId: string;
  when: string;
};

export const TRANSACTIONS: Transaction[] = [
  {
    id: "t-1",
    type: "charge",
    label: "Valentina R · 20% cashback",
    grossCents: 1_840_00,
    feeCents: -66_24,
    netCents: 1_773_76,
    status: "pending",
    stripeObjectId: "ch_3Qa1H2DtV9HHKsoy0FvX1Xy7",
    when: "2h ago",
  },
  {
    id: "t-2",
    type: "charge",
    label: "Lucas M · 10% cashback",
    grossCents: 920_00,
    feeCents: -36_12,
    netCents: 883_88,
    status: "available",
    stripeObjectId: "ch_3Qa0pADtV9HHKsoy1JKp9Lm2",
    when: "4h ago",
  },
  {
    id: "t-3",
    type: "payout",
    label: "Payout · BBVA ···4421",
    grossCents: -52_000_00,
    feeCents: 0,
    netCents: -52_000_00,
    status: "paid",
    stripeObjectId: "po_1Qa0NRDtV9HHKsoy7m1V4Zwq",
    when: "Yesterday",
  },
  {
    id: "t-4",
    type: "charge",
    label: "Renata G · welcome coupon",
    grossCents: 640_00,
    feeCents: -26_04,
    netCents: 613_96,
    status: "available",
    stripeObjectId: "ch_3QZyV4DtV9HHKsoy0iLnPj9C",
    when: "Yesterday",
  },
  {
    id: "t-5",
    type: "refund",
    label: "Sofía P · partial refund",
    grossCents: -400_00,
    feeCents: 14_40,
    netCents: -385_60,
    status: "refunded",
    stripeObjectId: "re_3QZxR9DtV9HHKsoy0t8mKqYn",
    when: "2 days ago",
  },
  {
    id: "t-6",
    type: "fee",
    label: "Mesita platform fee · May",
    grossCents: -2_400_00,
    feeCents: 0,
    netCents: -2_400_00,
    status: "paid",
    stripeObjectId: "txn_1QZv8gDtV9HHKsoy0FtbA1nQ",
    when: "3 days ago",
  },
  {
    id: "t-7",
    type: "transfer",
    label: "Transfer · Mesita platform → Express acct",
    grossCents: 18_500_00,
    feeCents: 0,
    netCents: 18_500_00,
    status: "paid",
    stripeObjectId: "tr_1QZuW3DtV9HHKsoy7HSrM8Wb",
    when: "4 days ago",
  },
  {
    id: "t-8",
    type: "payout",
    label: "Payout · BBVA ···4421",
    grossCents: -48_300_00,
    feeCents: 0,
    netCents: -48_300_00,
    status: "paid",
    stripeObjectId: "po_1QZsKADtV9HHKsoy3yQp1Rfg",
    when: "1 week ago",
  },
];

// ── Team (team/page.tsx) ──────────────────────────────────────────────────

export type TeamMember = {
  id: string;
  name: string;
  role: "Owner" | "Manager";
  access: "full";
  avatar: string;
  lastActive: string;
};

export const TEAM: TeamMember[] = [
  {
    id: "m-1",
    name: "Iván Solís",
    role: "Owner",
    access: "full",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80&auto=format&fit=crop&crop=faces",
    lastActive: "Now",
  },
  {
    id: "m-2",
    name: "Marta R.",
    role: "Manager",
    access: "full",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80&auto=format&fit=crop&crop=faces",
    lastActive: "1h ago",
  },
];

export type Validator = {
  id: string;
  name: string;
  role: "Waiter" | "Host";
  phone: string;
  lastActive: string;
};

export const VALIDATORS: Validator[] = [
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
