"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { cn } from "@/lib/utils";
import {
  SOCIAL_PEOPLE,
  socialRelevance,
  type SocialPerson,
} from "./social-feed-data";
import { SocialActivityRow } from "./social-activity-row";
import { SocialProfileModal } from "./SocialProfileModal";
import { GLOBAL_ACTIVITY } from "@/components/consumer/consumer-activity-data";
import { ConsumerActivityList } from "@/components/consumer/ConsumerActivityList";

// Two ways to order the activity feed: most-recent-first, or by how relevant
// the person is (weighted engagement, see socialRelevance). Relevance is
// the default and leads the toggle.
type SocialSort = "recent" | "relevance";
const SORT_MODES: { key: SocialSort; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "recent", label: "Recent" },
];

// Social mode — the live activity feed. Each row splits into two tap
// targets: the person (opens the profile modal) and the place chip on the
// right (navigates to the place detail). Rows resolve their place against
// the REAL deck passed down from the server fetch; when the catalog is
// empty the chip degrades to an inert mock name so the feed still reads.
//
// GLOBAL ACTIVITY LIVES HERE NOW (Pato, 2026-08-17: "global activity is going
// to be displayed in social in home"). It used to be a toggle inside Inbox >
// Notifications, which was the wrong home twice over: it isn't a notification
// (nothing happened to YOU), and it is exactly what Social is for — other
// people moving on Mesita. Notifications kept only your own activity.
//
// TODO(EF): social feed — people + events are mock (see social-feed-data.ts).

// Per-refresh jitter so the mock feed visibly reshuffles like new activity
// arriving. Randomness must live OUTSIDE render (react-hooks/purity) — we mint
// a fresh jitter table in the refresh event handler / on first mount instead.
type Jitter = { recent: number; relevance: number };
function makeJitter(): Map<string, Jitter> {
  return new Map(
    SOCIAL_PEOPLE.map((p) => [
      p.id,
      { recent: Math.random() * 20, relevance: Math.random() * 10 },
    ]),
  );
}

export function SocialFeed({ places }: { places: Place[] }) {
  const [profile, setProfile] = useState<SocialPerson | null>(null);
  const [sort, setSort] = useState<SocialSort>("relevance");
  // No websocket yet — the feed refreshes on demand via this button. Each
  // refresh swaps in a fresh jitter table (minted in the handler, off the
  // render path); this is the hook point for the future social EF read.
  const [jitter, setJitter] = useState<Map<string, Jitter>>(makeJitter);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setJitter(makeJitter());
    // Brief spin so the manual refresh reads as a real fetch.
    setTimeout(() => setRefreshing(false), 500);
  };

  const people = useMemo(() => {
    const scored = SOCIAL_PEOPLE.map((p) => {
      const j = jitter.get(p.id);
      return {
        p,
        recent: p.minutesAgo + (j?.recent ?? 0),
        relevance: socialRelevance(p) + (j?.relevance ?? 0),
      };
    });
    scored.sort((a, b) =>
      sort === "recent" ? a.recent - b.recent : b.relevance - a.relevance,
    );
    return scored.map((s) => s.p);
  }, [sort, jitter]);

  return (
    <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
      <div className="px-4 pt-4 pb-6">
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Activity
          </p>
          <div className="flex items-center gap-2">
            <span className="text-primary bg-primary/10 flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold">
              <span className="relative flex h-1.5 w-1.5">
                <span className="bg-primary absolute inset-0 animate-ping rounded-full opacity-75" />
                <span className="bg-primary relative h-1.5 w-1.5 rounded-full" />
              </span>
              Live
            </span>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              aria-label="Refresh activity"
              className="border-border bg-card text-muted-foreground hover:text-foreground shadow-rest flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition active:scale-95 disabled:opacity-60"
            >
              <RefreshCw
                className={cn("h-3 w-3", refreshing && "animate-spin")}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Sort toggle — Relevance (default) vs Recent */}
        <div className="bg-muted/60 mb-3 flex gap-1 rounded-xl p-1">
          {SORT_MODES.map((mode) => (
            <button
              key={mode.key}
              type="button"
              onClick={() => setSort(mode.key)}
              aria-pressed={sort === mode.key}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-semibold transition",
                sort === mode.key
                  ? "bg-card text-foreground shadow-rest"
                  : "text-muted-foreground",
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {people.map((p) => {
            const place =
              places.length > 0 ? places[p.placeSlot % places.length] : null;
            return (
              <SocialActivityRow
                key={p.id}
                person={p}
                place={place}
                onPersonClick={setProfile}
              />
            );
          })}
        </div>

        {/* Global activity — what's happening on Mesita generally, as opposed
            to the people rows above. Anonymised: it's other guests' moves, so
            it names the beat, never the person. */}
        {GLOBAL_ACTIVITY.length > 0 ? (
          <>
            <div className="mt-6 mb-3 flex items-center gap-3 px-1">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                On Mesita
              </p>
              <span className="bg-border h-px flex-1" />
            </div>
            <ConsumerActivityList items={GLOBAL_ACTIVITY} anonymisedNote />
          </>
        ) : null}
      </div>

      <SocialProfileModal person={profile} onClose={() => setProfile(null)} />
    </div>
  );
}
