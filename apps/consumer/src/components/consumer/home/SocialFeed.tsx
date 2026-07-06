"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Crown, Instagram, RefreshCw } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { cn, firstInitial } from "@/lib/utils";
import { placeHref } from "@/lib/place-route";
import {
  SOCIAL_ACTION_META,
  SOCIAL_PEOPLE,
  socialRelevance,
  type SocialPerson,
} from "./social-feed-data";
import { SocialProfileModal } from "./SocialProfileModal";

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
          <div className="flex items-center gap-2.5">
            <span className="text-primary flex items-center gap-1.5 text-[10px] font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="bg-primary absolute inset-0 animate-ping rounded-full opacity-75" />
                <span className="bg-primary relative h-2 w-2 rounded-full" />
              </span>
              Live
            </span>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              aria-label="Refresh activity"
              className="text-muted-foreground hover:text-foreground transition active:scale-90 disabled:opacity-60"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
              />
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
                  ? "bg-card text-foreground shadow-sm"
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
            const meta = SOCIAL_ACTION_META[p.action];
            return (
              <div
                key={p.id}
                className="border-border bg-card flex w-full items-center gap-2 rounded-2xl border p-2.5"
              >
                {/* Person → profile modal */}
                <button
                  type="button"
                  onClick={() => setProfile(p)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left transition active:scale-[0.99]"
                >
                  <div className="relative shrink-0">
                    <Image
                      src={p.avatarUrl}
                      alt={p.name}
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-full object-cover"
                    />
                    {p.plan === "premium" && (
                      <span className="bg-tier-premium ring-background absolute -bottom-0.5 -left-0.5 grid h-4 w-4 place-items-center rounded-full text-white ring-2">
                        <Crown className="h-2.5 w-2.5 fill-current" />
                      </span>
                    )}
                    <span className="ring-background absolute -right-0.5 -bottom-0.5 grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white ring-2">
                      <Instagram className="h-2.5 w-2.5" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-foreground truncate text-sm leading-tight font-semibold">
                        {p.name}
                      </p>
                      <span
                        className={cn(
                          "inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full px-1.5 text-[10px] font-semibold",
                          meta.bg,
                          meta.color,
                        )}
                      >
                        <meta.Icon className="h-2.5 w-2.5" />
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-muted-foreground truncate text-[11px]">
                      {p.igHandle} · {p.time}
                    </p>
                  </div>
                </button>

                {/* Place → detail (real place when the deck has one) */}
                {place ? (
                  <Link
                    href={placeHref(place.slug || place.id)}
                    className="border-border bg-background/80 flex shrink-0 items-center gap-2 rounded-xl border p-1.5 pr-2 transition hover:shadow-sm active:scale-[0.99]"
                  >
                    <PlaceThumb name={place.name} photo={place.photos[0]} />
                    <span className="text-foreground max-w-[80px] truncate text-[11px] font-semibold">
                      {place.name}
                    </span>
                  </Link>
                ) : (
                  <div className="border-border bg-muted/40 flex shrink-0 items-center gap-2 rounded-xl border p-1.5 pr-2">
                    <PlaceThumb name={p.fallbackPlaceName} />
                    <span className="text-muted-foreground max-w-[80px] truncate text-[11px] font-semibold">
                      {p.fallbackPlaceName}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <SocialProfileModal person={profile} onClose={() => setProfile(null)} />
    </div>
  );
}

function PlaceThumb({ name, photo }: { name: string; photo?: string }) {
  if (photo) {
    return (
      <Image
        src={photo}
        alt={name}
        width={36}
        height={36}
        className="h-9 w-9 rounded-lg object-cover"
      />
    );
  }
  return (
    <div className="bg-pink-gradient grid h-9 w-9 place-items-center rounded-lg text-white/85">
      <span className="font-display text-sm font-bold">
        {firstInitial(name)}
      </span>
    </div>
  );
}
