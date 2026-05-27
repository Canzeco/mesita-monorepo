"use client";

import { useState } from "react";
import {
  Coins,
  Bookmark,
  CalendarCheck,
  Crown,
  Sparkles,
  Heart,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Activity strip below the cashback card on /pay. Two tabs:
//
//   Me    — the user's own events. The default. Booked, saved,
//           earned, upgraded — the surface treats personal history
//           as the core thing because that's what the user actually
//           cares about on a wallet page.
//
//   Live  — anonymised public activity stream. Social proof + energy
//           for new accounts whose "Me" tab is still empty. Pulsing
//           dot on the tab pill telegraphs that the feed is moving.
//
// Both lists share the same KIND_META so the icon language is
// consistent. The presence/absence of an `@handle` is the only
// visual hint for which feed you're on.

type Tab = "me" | "live";
type ActivityKind = "earned" | "saved" | "booked" | "upgraded" | "swiped";

type Activity = {
  id: string;
  kind: ActivityKind;
  /** Visible only on the Live feed. Omit for private items. */
  handle?: string;
  verb: string;
  venue?: string;
  when: string;
};

const KIND_META: Record<
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

// ── Private / personal activity ──────────────────────────────────────────
// Once consumer-list-activity ships these come from a per-user query.
// Verbs lead with "You" so the row reads naturally in second person.

const MY_ACTIVITY: Activity[] = [
  {
    id: "m1",
    kind: "earned",
    verb: "You earned MX$340 cashback at",
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
    verb: "You saved a coupon at",
    venue: "Mar Verde",
    when: "3 days ago",
  },
  {
    id: "m4",
    kind: "upgraded",
    verb: "You upgraded to",
    venue: "Mesita Gold",
    when: "1 week ago",
  },
];

// ── Live / community activity ────────────────────────────────────────────
// Anonymised: handles, venues, and amounts get shuffled before render.

const LIVE_ACTIVITY: Activity[] = [
  {
    id: "l1",
    kind: "earned",
    handle: "@maria",
    verb: "earned MX$120 cashback at",
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
    venue: "Mesita Diamond",
    when: "8 min ago",
  },
  {
    id: "l4",
    kind: "saved",
    handle: "@diego",
    verb: "saved a coupon at",
    venue: "Casa Luminar",
    when: "12 min ago",
  },
  {
    id: "l5",
    kind: "earned",
    handle: "@lucia",
    verb: "earned MX$340 cashback at",
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

export function ActivityFeed() {
  const [tab, setTab] = useState<Tab>("me");
  const items = tab === "me" ? MY_ACTIVITY : LIVE_ACTIVITY;

  return (
    <section className="flex flex-col gap-3">
      <header>
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
          Activity
        </p>
        <h2 className="font-display mt-0.5 text-lg font-semibold tracking-tight">
          {tab === "me" ? "Your recent moves" : "What's happening on Mesita"}
        </h2>
      </header>

      <div className="border-border bg-card flex rounded-full border p-1">
        <TabButton
          active={tab === "me"}
          onClick={() => setTab("me")}
          label="Me"
          count={MY_ACTIVITY.length}
        />
        <TabButton
          active={tab === "live"}
          onClick={() => setTab("live")}
          label="Live"
          count={LIVE_ACTIVITY.length}
          dot
        />
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((a) => {
          const meta = KIND_META[a.kind];
          return (
            <li
              key={a.id}
              className="border-border bg-card flex items-center gap-3 rounded-xl border p-3"
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  meta.bg,
                )}
              >
                <meta.Icon
                  className={cn("h-4 w-4", meta.color)}
                  strokeWidth={2.25}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-[13px] leading-snug">
                  {a.handle && (
                    <strong className="font-semibold">{a.handle}</strong>
                  )}
                  {a.handle ? " " : ""}
                  {a.verb}{" "}
                  {a.venue && (
                    <strong className="text-foreground font-semibold">
                      {a.venue}
                    </strong>
                  )}
                </p>
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  {a.when}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {tab === "live" && (
        <p className="text-muted-foreground inline-flex items-center justify-center gap-1.5 text-[11px]">
          <Sparkles className="h-3 w-3" />
          Anonymised — handles, venues, and amounts are shuffled.
        </p>
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  dot = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
        active ? "bg-foreground text-background" : "text-muted-foreground",
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={cn(
              "absolute inset-0 animate-ping rounded-full",
              active ? "bg-emerald-300/70" : "bg-emerald-500/60",
            )}
          />
          <span
            className={cn(
              "relative h-1.5 w-1.5 rounded-full",
              active ? "bg-emerald-300" : "bg-emerald-500",
            )}
          />
        </span>
      )}
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
          active
            ? "bg-background/20 text-background"
            : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}
