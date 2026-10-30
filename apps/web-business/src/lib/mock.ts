// Every name and number in this console is invented. Nothing here is read from
// or written to a backend: the MockBanner says so on every screen. When the
// Edge Functions exist, each export below becomes one call, and the shapes stay.

import {
  DEFAULT_CAP_MXN,
  amountDue,
  creditsForPrepayment,
  rewardsForVisit,
  tipFor,
  type RewardId,
  type RewardRule,
  type VisitRewards,
} from "./rewards";

export type Plan = "Free" | "Premier 2X" | "Premier 5X";

export const place = {
  name: "Lumbre y Sal",
  neighborhood: "San Pedro Garza García",
  plan: "Free" as Plan,
  verified: true,
  stripeConnected: true,
  instagram: "@lumbreysal.mty",
  googleReviewLink: "https://g.page/r/lumbreysal/review",
  website: "lumbreysal.mx",
  phone: "+52 81 5555 0142",
  description: "Wood-fire grill and natural wines. Long tables, late kitchen on weekends.",
  hours: [
    ["Mon", "Closed"],
    ["Tue–Thu", "1:30 pm – 11:00 pm"],
    ["Fri–Sat", "1:30 pm – 1:00 am"],
    ["Sun", "1:30 pm – 9:00 pm"],
  ] as const,
};

export const rewardRules: RewardRule[] = [
  {
    id: "instagram-story",
    name: "Instagram Story Reward",
    requirement: "A public story tagging the place, from an account with 1,000+ followers",
    enabled: true,
    percent: 15,
    mode: "discount",
  },
  {
    id: "google-review",
    name: "Google Review Reward",
    requirement: "A Google review of the place, whatever the rating",
    enabled: true,
    percent: 5,
    mode: "discount",
  },
  {
    id: "vip-class",
    name: "VIP Class Reward",
    requirement: "Guests invited to the VIP Class",
    enabled: true,
    percent: 10,
    mode: "cashback",
  },
  {
    id: "loyalty",
    name: "Loyalty Reward",
    requirement: "Every 7th verified visit to the place",
    enabled: true,
    percent: 15,
    mode: "cashback",
  },
  {
    id: "welcome",
    name: "Welcome Reward",
    requirement: "A guest's first visit to the place",
    enabled: false,
    percent: 10,
    mode: "discount",
  },
];

export const rewardCap = DEFAULT_CAP_MXN;
export const tipPercents = [10, 15, 20];

export const rewardShort: Record<RewardId, string> = {
  "instagram-story": "Story",
  "google-review": "Review",
  "vip-class": "VIP",
  loyalty: "Loyalty",
  welcome: "Welcome",
};

export type Guest = {
  id: string;
  name: string;
  vip: boolean;
  instagramFollowers: number | null;
  handle: string | null;
  visitsHere: number;
};

export const guests: Guest[] = [
  { id: "g1", name: "Valeria Treviño", vip: true, instagramFollowers: 18400, handle: "@vale.trevino", visitsHere: 9 },
  { id: "g2", name: "Diego Garza", vip: false, instagramFollowers: 2310, handle: "@diegogarza", visitsHere: 1 },
  { id: "g3", name: "Mariana Leal", vip: false, instagramFollowers: 640, handle: "@marianaleal", visitsHere: 7 },
  { id: "g4", name: "Rodrigo Elizondo", vip: true, instagramFollowers: 5120, handle: "@ro.elizondo", visitsHere: 4 },
  { id: "g5", name: "Sofía Villarreal", vip: false, instagramFollowers: 12900, handle: "@sofiavillarreal", visitsHere: 2 },
  { id: "g6", name: "Andrés Cantú", vip: false, instagramFollowers: null, handle: null, visitsHere: 3 },
  { id: "g7", name: "Regina Salinas", vip: false, instagramFollowers: 1480, handle: "@regi.salinas", visitsHere: 1 },
  { id: "g8", name: "Emilio Zambrano", vip: true, instagramFollowers: 3300, handle: "@emiliozam", visitsHere: 14 },
];

export const guestById = (id: string) => guests.find((g) => g.id === id)!;

export type PaidWith = "Mesita Pay" | "Credits" | "Other";
export type VisitStatus = "waiting" | "approved" | "rejected";

export type Visit = {
  id: string;
  guestId: string;
  day: "Today" | "Yesterday" | "Tue 27 Oct" | "Sat 24 Oct";
  time: string;
  party: number;
  bill: number;
  earned: RewardId[];
  chosen: RewardId[];
  rewards: VisitRewards;
  tipPercent: number;
  tip: number;
  due: number;
  paidWith: PaidWith;
  status: VisitStatus;
  approvedBy: string | null;
  review?: string;
};

type VisitSeed = Omit<Visit, "rewards" | "tip" | "due">;

const seeds: VisitSeed[] = [
  { id: "v-1048", guestId: "g2", day: "Today", time: "9:12 pm", party: 4, bill: 2380, earned: ["instagram-story", "google-review"], chosen: ["instagram-story", "google-review"], tipPercent: 15, paidWith: "Mesita Pay", status: "waiting", approvedBy: null },
  { id: "v-1047", guestId: "g8", day: "Today", time: "9:05 pm", party: 2, bill: 1460, earned: ["vip-class", "instagram-story"], chosen: ["instagram-story", "vip-class"], tipPercent: 10, paidWith: "Credits", status: "waiting", approvedBy: null },
  { id: "v-1046", guestId: "g1", day: "Today", time: "8:41 pm", party: 3, bill: 1890, earned: ["vip-class", "instagram-story", "google-review"], chosen: ["instagram-story", "vip-class"], tipPercent: 15, paidWith: "Mesita Pay", status: "approved", approvedBy: "Ana" },
  { id: "v-1045", guestId: "g3", day: "Today", time: "8:20 pm", party: 2, bill: 980, earned: ["loyalty", "google-review"], chosen: ["loyalty", "google-review"], tipPercent: 10, paidWith: "Mesita Pay", status: "approved", approvedBy: "Ana", review: "The ribeye is the best in San Pedro. Ask for the bar seats." },
  { id: "v-1044", guestId: "g6", day: "Today", time: "7:58 pm", party: 5, bill: 3150, earned: ["google-review"], chosen: ["google-review"], tipPercent: 0, paidWith: "Other", status: "approved", approvedBy: "Luis", review: "Great for groups, a bit loud after 9." },
  { id: "v-1043", guestId: "g5", day: "Today", time: "7:31 pm", party: 2, bill: 1240, earned: ["instagram-story"], chosen: ["instagram-story"], tipPercent: 15, paidWith: "Mesita Pay", status: "approved", approvedBy: "Luis" },
  { id: "v-1042", guestId: "g7", day: "Today", time: "6:50 pm", party: 3, bill: 1610, earned: ["instagram-story"], chosen: ["instagram-story"], tipPercent: 10, paidWith: "Credits", status: "rejected", approvedBy: "Ana" },
  { id: "v-1041", guestId: "g4", day: "Yesterday", time: "10:02 pm", party: 6, bill: 4820, earned: ["vip-class", "instagram-story"], chosen: ["instagram-story", "vip-class"], tipPercent: 15, paidWith: "Mesita Pay", status: "approved", approvedBy: "Ana" },
  { id: "v-1040", guestId: "g1", day: "Yesterday", time: "9:15 pm", party: 2, bill: 1320, earned: ["vip-class"], chosen: ["vip-class"], tipPercent: 15, paidWith: "Credits", status: "approved", approvedBy: "Luis" },
  { id: "v-1039", guestId: "g3", day: "Yesterday", time: "2:40 pm", party: 1, bill: 420, earned: ["google-review"], chosen: ["google-review"], tipPercent: 10, paidWith: "Mesita Pay", status: "approved", approvedBy: "Luis", review: "Lunch menu is a steal." },
  { id: "v-1038", guestId: "g8", day: "Tue 27 Oct", time: "9:30 pm", party: 4, bill: 2960, earned: ["vip-class", "loyalty"], chosen: ["loyalty", "vip-class"], tipPercent: 15, paidWith: "Mesita Pay", status: "approved", approvedBy: "Ana" },
  { id: "v-1037", guestId: "g5", day: "Sat 24 Oct", time: "11:10 pm", party: 3, bill: 2240, earned: ["instagram-story", "google-review"], chosen: ["instagram-story", "google-review"], tipPercent: 10, paidWith: "Other", status: "approved", approvedBy: "Luis" },
];

export const visits: Visit[] = seeds.map((s) => {
  const rewards = rewardsForVisit(s.bill, s.earned, rewardRules, { cap: rewardCap, chosen: s.chosen });
  const tip = tipFor(s.bill, s.tipPercent);
  return { ...s, rewards, tip, due: amountDue(s.bill, rewards, tip) };
});

export const visitById = (id: string) => visits.find((v) => v.id === id);

export const staff = [
  { id: "s0", name: "Patricio Canseco", role: "Owner" as const, email: "pato@example.com", canApprove: true },
  { id: "s1", name: "Ana Rodríguez", role: "Staff" as const, email: "ana@example.com", canApprove: true },
  { id: "s2", name: "Luis Martínez", role: "Staff" as const, email: "luis@example.com", canApprove: true },
  { id: "s3", name: "Karla Ibarra", role: "Staff" as const, email: "karla@example.com", canApprove: false },
];

// ── Payments ────────────────────────────────────────────────────────────────

export type PaymentKind = "Bill" | "Prepayment";
export type Payment = {
  id: string;
  kind: PaymentKind;
  guestId: string;
  day: string;
  time: string;
  amount: number;
  tip: number;
  card: string;
  status: "Paid" | "Refunded";
  visitId?: string;
};

/** Mesita's platform fee on each card payment. Mock value: the real fee is not set yet. */
export const MESITA_FEE_RATE = 0.01;

const billPayments: Payment[] = visits
  .filter((v) => v.paidWith === "Mesita Pay" && v.status === "approved")
  .map((v, i) => ({
    id: `p-${2100 - i}`,
    kind: "Bill",
    guestId: v.guestId,
    day: v.day,
    time: v.time,
    amount: v.due,
    tip: v.tip,
    card: ["Visa ·· 4242", "Mastercard ·· 8812", "Apple Pay", "Google Pay"][i % 4],
    status: "Paid",
    visitId: v.id,
  }));

const prepayments: Payment[] = [
  { id: "p-2140", kind: "Prepayment", guestId: "g1", day: "Today", time: "6:12 pm", amount: 2000, tip: 0, card: "Apple Pay", status: "Paid" },
  { id: "p-2139", kind: "Prepayment", guestId: "g8", day: "Yesterday", time: "1:20 pm", amount: 1000, tip: 0, card: "Visa ·· 4242", status: "Paid" },
  { id: "p-2138", kind: "Prepayment", guestId: "g4", day: "Tue 27 Oct", time: "8:02 pm", amount: 500, tip: 0, card: "Mastercard ·· 8812", status: "Paid" },
];

export const payments: Payment[] = [...prepayments, ...billPayments].sort((a, b) =>
  b.id.localeCompare(a.id),
);

export const paymentById = (id: string) => payments.find((p) => p.id === id);

export const payouts = [
  { id: "po-31", date: "Thu 29 Oct", amount: 9840, status: "In transit" },
  { id: "po-30", date: "Wed 28 Oct", amount: 12410, status: "Paid" },
  { id: "po-29", date: "Tue 27 Oct", amount: 6230, status: "Paid" },
  { id: "po-28", date: "Mon 26 Oct", amount: 15920, status: "Paid" },
];

// ── Credits ─────────────────────────────────────────────────────────────────

export type CreditSource = "Prepayment" | "Cashback" | "Payment";
export type CreditEntry = {
  id: string;
  guestId: string;
  day: string;
  /** Positive: credit the place now owes. Negative: credit spent on a visit. */
  amount: number;
  source: CreditSource | "Spent";
  note: string;
  visitId?: string;
};

export const prepayAmounts = [
  { amount: 500, enabled: true },
  { amount: 1000, enabled: true },
  { amount: 2000, enabled: true },
  { amount: 5000, enabled: false },
];

const cashbackEntries: CreditEntry[] = visits
  .filter((v) => v.status === "approved" && v.rewards.cashback > 0)
  .map((v) => ({
    id: `c-cb-${v.id}`,
    guestId: v.guestId,
    day: v.day,
    amount: v.rewards.cashback,
    source: "Cashback",
    note: v.rewards.applied
      .filter((a) => a.mode === "cashback")
      .map((a) => rewardRules.find((r) => r.id === a.id)!.name)
      .join(" + "),
    visitId: v.id,
  }));

const spentEntries: CreditEntry[] = visits
  .filter((v) => v.paidWith === "Credits" && v.status === "approved")
  .map((v) => ({
    id: `c-sp-${v.id}`,
    guestId: v.guestId,
    day: v.day,
    amount: -v.due,
    source: "Spent",
    note: "Paid a visit with Credits",
    visitId: v.id,
  }));

export const creditEntries: CreditEntry[] = [
  ...prepayments.map((p) => ({
    id: `c-pp-${p.id}`,
    guestId: p.guestId,
    day: p.day,
    amount: creditsForPrepayment(p.amount),
    source: "Prepayment" as const,
    note: `Paid ${p.amount.toLocaleString("en-US", { style: "currency", currency: "MXN", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 })} + 10% bonus`,
  })),
  { id: "c-py-1", guestId: "g5", day: "Sat 24 Oct", amount: 180, source: "Payment", note: "Overcharge returned as credit" },
  { id: "c-pp-old-1", guestId: "g3", day: "Sat 24 Oct", amount: 1100, source: "Prepayment", note: "Paid $1,000 + 10% bonus" },
  ...cashbackEntries,
  ...spentEntries,
];

const dayRank = ["Today", "Yesterday", "Tue 27 Oct", "Sat 24 Oct"];
creditEntries.sort((a, b) => dayRank.indexOf(a.day) - dayRank.indexOf(b.day));

export function balances() {
  const map = new Map<string, { guestId: string; balance: number; bySource: Record<CreditSource, number> }>();
  for (const e of creditEntries) {
    const row = map.get(e.guestId) ?? {
      guestId: e.guestId,
      balance: 0,
      bySource: { Prepayment: 0, Cashback: 0, Payment: 0 },
    };
    row.balance += e.amount;
    if (e.source !== "Spent") row.bySource[e.source] += e.amount;
    map.set(e.guestId, row);
  }
  return [...map.values()].filter((r) => r.balance > 0.5).sort((a, b) => b.balance - a.balance);
}

// ── Profile, Premier, Coming soon ───────────────────────────────────────────

export const profileChecklist = [
  { label: "Claim the place", done: true },
  { label: "Verify ownership", done: true },
  { label: "Description", done: true },
  { label: "Hours", done: true },
  { label: "At least 8 photos", done: false },
  { label: "Cover photo", done: false },
  { label: "Instagram account", done: false },
  { label: "Google review link", done: false },
  { label: "Website", done: false },
  { label: "Menu link", done: false },
];

export const photos = [
  { id: "ph1", label: "Dining room", tone: "from-orange-300 to-rose-500" },
  { id: "ph2", label: "Ribeye", tone: "from-amber-300 to-red-600" },
  { id: "ph3", label: "Bar", tone: "from-rose-300 to-fuchsia-600" },
  { id: "ph4", label: "Terrace", tone: "from-lime-200 to-emerald-500" },
  { id: "ph5", label: "Wine wall", tone: "from-purple-300 to-rose-700" },
];

export const stories = visits
  .filter((v) => v.status === "approved" && v.rewards.applied.some((a) => a.id === "instagram-story"))
  .map((v, i) => ({
    visitId: v.id,
    guestId: v.guestId,
    day: v.day,
    tone: ["from-rose-400 to-orange-300", "from-fuchsia-500 to-rose-400", "from-amber-400 to-pink-500", "from-red-500 to-amber-300"][i % 4],
    caption: ["Best ribeye in town 🔥", "Sunday wines", "Fire kitchen", "Date night"][i % 4],
  }));

export const comingSoon = [
  { name: "Digital Menu", line: "Your menu, built from a photo, on every channel." },
  { name: "Express Website", line: "A site on your own domain, made from your profile." },
  { name: "Online Reservations", line: "One calendar for every booking." },
  { name: "Online Orders", line: "Pickup and your own delivery, paid upfront." },
  { name: "Answering Agents", line: "Phone and WhatsApp answered for you." },
  { name: "Reviews Hub", line: "Every review in one place, replies drafted for you." },
  { name: "Mesita CRM", line: "One record per guest, every visit in it." },
  { name: "Mesita Capital", line: "Cash today for meals served later." },
  { name: "Developers Platform", line: "APIs and embeds for the tools you already use." },
];

export const premierTiers = [
  { name: "Premier 2X" as const, line: "Shown about twice as often in discovery." },
  { name: "Premier 5X" as const, line: "Shown about five times as often in discovery." },
];
