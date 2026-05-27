"use client";

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

// Live-activity strip below the cashback card on /pay. Mixes monetary
// events (earned cashback) with non-monetary ones (saved, booked,
// upgraded, swiped) so the surface reads as alive — not just a
// transaction log. Adds social-proof energy to what would otherwise be
// a wallet-empty page for new users.
//
// Mocked for now. Once the activity stream is live this becomes a
// short server fetch + Supabase realtime subscription.

type ActivityKind = "earned" | "saved" | "booked" | "upgraded" | "swiped";

type Activity = {
  id: string;
  kind: ActivityKind;
  handle: string;
  /** Verb phrase ending — used after the handle. */
  verb: string;
  /** Optional venue name highlighted in the line. */
  venue?: string;
  when: string;
};

const KIND_META: Record<
  ActivityKind,
  { Icon: LucideIcon; bg: string; color: string }
> = {
  earned: { Icon: Coins, bg: "bg-pink-500/10", color: "text-pink-600" },
  saved: {
    Icon: Bookmark,
    bg: "bg-amber-500/10",
    color: "text-amber-600",
  },
  booked: {
    Icon: CalendarCheck,
    bg: "bg-emerald-500/10",
    color: "text-emerald-600",
  },
  upgraded: { Icon: Crown, bg: "bg-violet-500/10", color: "text-violet-600" },
  swiped: { Icon: Heart, bg: "bg-rose-500/10", color: "text-rose-600" },
};

const ACTIVITY: Activity[] = [
  {
    id: "a1",
    kind: "earned",
    handle: "@maria",
    verb: "earned MX$120 cashback at",
    venue: "Mar Verde",
    when: "2 min ago",
  },
  {
    id: "a2",
    kind: "booked",
    handle: "@carlos",
    verb: "booked a table at",
    venue: "Neón Bar",
    when: "5 min ago",
  },
  {
    id: "a3",
    kind: "upgraded",
    handle: "@sofia",
    verb: "just upgraded to",
    venue: "Mesita Diamond",
    when: "8 min ago",
  },
  {
    id: "a4",
    kind: "saved",
    handle: "@diego",
    verb: "saved a coupon at",
    venue: "Casa Luminar",
    when: "12 min ago",
  },
  {
    id: "a5",
    kind: "earned",
    handle: "@lucia",
    verb: "earned MX$340 cashback at",
    venue: "Atelier Nueve",
    when: "18 min ago",
  },
  {
    id: "a6",
    kind: "swiped",
    handle: "@pat",
    verb: "swiped right on",
    venue: "Ferment & Co",
    when: "24 min ago",
  },
];

export function ActivityFeed() {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
            Live activity
          </p>
          <h2 className="font-display mt-0.5 text-lg font-semibold tracking-tight">
            What&apos;s happening on Mesita
          </h2>
        </div>
        <span className="bg-emerald-500/10 text-emerald-700 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
          <span className="bg-emerald-500 relative flex h-1.5 w-1.5 rounded-full">
            <span className="bg-emerald-500/60 absolute inset-0 animate-ping rounded-full" />
          </span>
          Live
        </span>
      </header>

      <ul className="flex flex-col gap-2">
        {ACTIVITY.map((a) => {
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
                  <strong className="font-semibold">{a.handle}</strong>{" "}
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

      <p className="text-muted-foreground inline-flex items-center justify-center gap-1.5 text-[11px]">
        <Sparkles className="h-3 w-3" />
        Anonymised — handles, venues, and amounts are shuffled.
      </p>
    </section>
  );
}
