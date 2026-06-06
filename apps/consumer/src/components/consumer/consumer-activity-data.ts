import {
  Coins,
  Bookmark,
  CalendarCheck,
  Crown,
  Heart,
  type LucideIcon,
} from "lucide-react";

export type ActivityKind = "earned" | "saved" | "booked" | "upgraded" | "swiped";

export type ConsumerActivity = {
  id: string;
  kind: ActivityKind;
  /** Visible only on the global feed. Omit for private items. */
  handle?: string;
  verb: string;
  venue?: string;
  when: string;
};

export const ACTIVITY_KIND_META: Record<
  ActivityKind,
  { Icon: LucideIcon; bg: string; color: string }
> = {
  earned: { Icon: Coins, bg: "bg-pink-500/10", color: "text-pink-600" },
  saved: { Icon: Bookmark, bg: "bg-amber-500/10", color: "text-amber-600" },
  booked: {
    Icon: CalendarCheck,
    bg: "bg-emerald-500/10",
    color: "text-emerald-600",
  },
  upgraded: { Icon: Crown, bg: "bg-violet-500/10", color: "text-violet-600" },
  swiped: { Icon: Heart, bg: "bg-rose-500/10", color: "text-rose-600" },
};

export const MY_ACTIVITY: ConsumerActivity[] = [
  {
    id: "m1",
    kind: "earned",
    verb: "You saved MX$340 with your discount at",
    venue: "Casa Luminar",
    when: "yesterday",
  },
  {
    id: "m2",
    kind: "booked",
    verb: "You booked a table at",
    venue: "Neón Bar",
    when: "2 days ago",
  },
  {
    id: "m3",
    kind: "saved",
    verb: "You unlocked a reward at",
    venue: "Mar Verde",
    when: "3 days ago",
  },
  {
    id: "m4",
    kind: "upgraded",
    verb: "You upgraded to",
    venue: "Mesita Premium",
    when: "1 week ago",
  },
];

export const GLOBAL_ACTIVITY: ConsumerActivity[] = [
  {
    id: "l1",
    kind: "earned",
    handle: "@maria",
    verb: "saved MX$120 with a discount at",
    venue: "Mar Verde",
    when: "2 min ago",
  },
  {
    id: "l2",
    kind: "booked",
    handle: "@carlos",
    verb: "booked a table at",
    venue: "Neón Bar",
    when: "5 min ago",
  },
  {
    id: "l3",
    kind: "upgraded",
    handle: "@sofia",
    verb: "just upgraded to",
    venue: "Mesita Premium",
    when: "8 min ago",
  },
  {
    id: "l4",
    kind: "saved",
    handle: "@diego",
    verb: "unlocked a reward at",
    venue: "Casa Luminar",
    when: "12 min ago",
  },
  {
    id: "l5",
    kind: "earned",
    handle: "@lucia",
    verb: "saved MX$340 with a discount at",
    venue: "Atelier Nueve",
    when: "18 min ago",
  },
  {
    id: "l6",
    kind: "swiped",
    handle: "@pat",
    verb: "swiped right on",
    venue: "Ferment & Co",
    when: "24 min ago",
  },
];
