// TODO(EF): social feed — this whole dataset is a parked mock. When the
// social backend lands (follows + live check-in/like/reward/story events),
// swap SOCIAL_PEOPLE for an EF read and keep the row/meta contracts below.
//
// People don't hardcode place ids: each row carries a `placeSlot` index that
// the feed resolves against the REAL server-fetched deck, so the chips always
// point at places that exist in this environment (and survive DB resets).
// `fallbackPlaceName` covers the empty-catalog case with an inert chip.

import {
  Camera,
  Heart,
  MapPin,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type SocialActionKind = "visit" | "like" | "reward" | "story";

// Differentiated chip tints per action — same /10-tint + -600-text recipe as
// ACTIVITY_KIND_META in consumer-activity-data.ts (kept separate because
// that file is a parked building block we don't modify).
export const SOCIAL_ACTION_META: Record<
  SocialActionKind,
  { label: string; Icon: LucideIcon; color: string; bg: string }
> = {
  visit: {
    label: "Visit",
    Icon: MapPin,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  like: {
    label: "Like",
    Icon: Heart,
    color: "text-rose-600",
    bg: "bg-rose-500/10",
  },
  reward: {
    label: "Reward",
    Icon: Sparkles,
    color: "text-amber-600",
    bg: "bg-amber-500/10",
  },
  story: {
    label: "Story",
    Icon: Camera,
    color: "text-fuchsia-600",
    bg: "bg-fuchsia-500/10",
  },
};

export type SocialPerson = {
  id: string;
  name: string;
  igHandle: string;
  plan: "free" | "premium";
  avatarUrl: string;
  action: SocialActionKind;
  /** Index into the live deck (modulo length) — resolves to a real place. */
  placeSlot: number;
  /** Chip copy when the catalog is empty and no real place resolves. */
  fallbackPlaceName: string;
  time: string;
  /** Numeric recency for the "Recent" sort — minutes since the event. */
  minutesAgo: number;
  stats: { visits: number; likes: number; stories: number; rewards: number };
};

// Relevance score — how much this person should surface in the "Relevance"
// sort. Weighted engagement (rewards + likes count most), with a premium
// bump. Higher = more relevant. Pure function of the row so it stays stable.
export function socialRelevance(p: SocialPerson): number {
  const { visits, likes, stories, rewards } = p.stats;
  const engagement = visits + likes * 2 + stories + rewards * 3;
  return p.plan === "premium" ? Math.round(engagement * 1.15) : engagement;
}

export const SOCIAL_PEOPLE: SocialPerson[] = [
  {
    id: "sofi",
    name: "Sofía Méndez",
    igHandle: "@sofi.mz",
    plan: "premium",
    avatarUrl: "https://i.pravatar.cc/200?img=20",
    action: "visit",
    placeSlot: 0,
    fallbackPlaceName: "Casa Luminar",
    time: "2m",
    minutesAgo: 2,
    stats: { visits: 42, likes: 18, stories: 9, rewards: 7 },
  },
  {
    id: "ana",
    name: "Ana Sofía",
    igHandle: "@ana.sof",
    plan: "free",
    avatarUrl: "https://i.pravatar.cc/200?img=47",
    action: "story",
    placeSlot: 0,
    fallbackPlaceName: "Casa Luminar",
    time: "just now",
    minutesAgo: 0,
    stats: { visits: 11, likes: 23, stories: 14, rewards: 2 },
  },
  {
    id: "pablo",
    name: "Pablo Treviño",
    igHandle: "@pablo.tr",
    plan: "premium",
    avatarUrl: "https://i.pravatar.cc/200?img=33",
    action: "like",
    placeSlot: 1,
    fallbackPlaceName: "Neón Bar",
    time: "8m",
    minutesAgo: 8,
    stats: { visits: 35, likes: 61, stories: 4, rewards: 12 },
  },
  {
    id: "diego",
    name: "Diego R.",
    igHandle: "@diego.r",
    plan: "free",
    avatarUrl: "https://i.pravatar.cc/200?img=12",
    action: "story",
    placeSlot: 2,
    fallbackPlaceName: "Mar Verde",
    time: "4m",
    minutesAgo: 4,
    stats: { visits: 8, likes: 15, stories: 22, rewards: 1 },
  },
  {
    id: "mariana",
    name: "Mariana",
    igHandle: "@mari.mx",
    plan: "premium",
    avatarUrl: "https://i.pravatar.cc/200?img=32",
    action: "reward",
    placeSlot: 0,
    fallbackPlaceName: "Casa Luminar",
    time: "22m",
    minutesAgo: 22,
    stats: { visits: 57, likes: 30, stories: 6, rewards: 19 },
  },
  {
    id: "luis",
    name: "Luis P.",
    igHandle: "@luis.p",
    plan: "free",
    avatarUrl: "https://i.pravatar.cc/200?img=53",
    action: "visit",
    placeSlot: 2,
    fallbackPlaceName: "Mar Verde",
    time: "28m",
    minutesAgo: 28,
    stats: { visits: 16, likes: 9, stories: 3, rewards: 4 },
  },
  {
    id: "camila",
    name: "Camila V.",
    igHandle: "@cami.v",
    plan: "premium",
    avatarUrl: "https://i.pravatar.cc/200?img=23",
    action: "like",
    placeSlot: 3,
    fallbackPlaceName: "Atelier Nueve",
    time: "1h",
    minutesAgo: 60,
    stats: { visits: 28, likes: 44, stories: 11, rewards: 8 },
  },
  {
    id: "tomas",
    name: "Tomás G.",
    igHandle: "@tomas.g",
    plan: "free",
    avatarUrl: "https://i.pravatar.cc/200?img=14",
    action: "reward",
    placeSlot: 4,
    fallbackPlaceName: "Ferment & Co",
    time: "1h",
    minutesAgo: 60,
    stats: { visits: 13, likes: 7, stories: 2, rewards: 5 },
  },
  {
    id: "renata",
    name: "Renata L.",
    igHandle: "@ren.lz",
    plan: "free",
    avatarUrl: "https://i.pravatar.cc/200?img=49",
    action: "story",
    placeSlot: 5,
    fallbackPlaceName: "Panadería Sur",
    time: "4h",
    minutesAgo: 240,
    stats: { visits: 6, likes: 12, stories: 17, rewards: 1 },
  },
  {
    id: "andres",
    name: "Andrés C.",
    igHandle: "@andres.c",
    plan: "premium",
    avatarUrl: "https://i.pravatar.cc/200?img=15",
    action: "story",
    placeSlot: 6,
    fallbackPlaceName: "Azul Club",
    time: "5h",
    minutesAgo: 300,
    stats: { visits: 49, likes: 26, stories: 31, rewards: 10 },
  },
  {
    id: "mateo",
    name: "Mateo V.",
    igHandle: "@mateo.v",
    plan: "premium",
    avatarUrl: "https://i.pravatar.cc/200?img=11",
    action: "like",
    placeSlot: 3,
    fallbackPlaceName: "Atelier Nueve",
    time: "6h",
    minutesAgo: 360,
    stats: { visits: 33, likes: 52, stories: 5, rewards: 14 },
  },
  {
    id: "lucia",
    name: "Lucía Garza",
    igHandle: "@lu.gza",
    plan: "free",
    avatarUrl: "https://i.pravatar.cc/200?img=25",
    action: "reward",
    placeSlot: 5,
    fallbackPlaceName: "Panadería Sur",
    time: "8h",
    minutesAgo: 480,
    stats: { visits: 21, likes: 19, stories: 8, rewards: 6 },
  },
];
