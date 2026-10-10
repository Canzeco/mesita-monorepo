import {
  Coins,
  Bookmark,
  CalendarCheck,
  Crown,
  Heart,
  type LucideIcon,
} from "lucide-react";

type ActivityKind = "earned" | "saved" | "booked" | "upgraded" | "swiped";

export type ConsumerActivity = {
  id: string;
  kind: ActivityKind;
  /** Visible only on the global feed. Omit for private items. */
  handle?: string;
  verb: string;
  place?: string;
  when: string;
};

export const ACTIVITY_KIND_META: Record<
  ActivityKind,
  { Icon: LucideIcon; bg: string; color: string }
> = {
  earned: { Icon: Coins, bg: "bg-muted", color: "text-muted-foreground" },
  saved: { Icon: Bookmark, bg: "bg-muted", color: "text-muted-foreground" },
  booked: {
    Icon: CalendarCheck,
    bg: "bg-muted",
    color: "text-muted-foreground",
  },
  upgraded: { Icon: Crown, bg: "bg-muted", color: "text-muted-foreground" },
  swiped: { Icon: Heart, bg: "bg-muted", color: "text-muted-foreground" },
};

// MVP cut (MESITA-2078): the money demo rows (discount savings, the
// Premium upgrade) are hidden while Pay is parked. The `earned` and
// `upgraded` kinds stay so un-parking is re-adding rows.
export const MY_ACTIVITY: ConsumerActivity[] = [
  {
    id: "m2",
    kind: "booked",
    verb: "You booked a table at",
    place: "Neón Bar",
    when: "2 days ago",
  },
  {
    id: "m3",
    kind: "saved",
    verb: "You saved",
    place: "Mar Verde",
    when: "3 days ago",
  },
];

// MVP cut (MESITA-2078): money demo rows hidden while Pay is parked.
export const GLOBAL_ACTIVITY: ConsumerActivity[] = [
  {
    id: "l2",
    kind: "booked",
    handle: "@carlos",
    verb: "booked a table at",
    place: "Neón Bar",
    when: "5 min ago",
  },
  {
    id: "l4",
    kind: "saved",
    handle: "@diego",
    verb: "saved",
    place: "Casa Luminar",
    when: "12 min ago",
  },
  {
    id: "l6",
    kind: "swiped",
    handle: "@pat",
    verb: "swiped right on",
    place: "Ferment & Co",
    when: "24 min ago",
  },
];
