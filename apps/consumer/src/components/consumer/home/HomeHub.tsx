"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Flame, Heart, Sparkles, Users, type LucideIcon } from "lucide-react";
import { SwipeDeck } from "@/app/(shell)/discover/swipe/SwipeDeck";
import type { Place } from "@/lib/api/places";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { HOME_MODE_PARAM, parseHomeMode, type HomeMode } from "./home-mode";
import { AskAiTab } from "./AskAiTab";
import { SocialFeed } from "./SocialFeed";
import { FavoritesList } from "./FavoritesList";

// The /home hub client. Receives the server-fetched deck once and flips
// between the three modes as pure client state — no route change, no
// refetch on switch. The shell renders no TopBar for /home, so the pill
// mode nav below IS the page's top chrome.
//
// Swipe leads (it's the default and the tab's identity); Ask AI — the Memo
// concierge — sits right after it, then Social and Favorites. The URL is the
// single source of truth for the mode: pills write ?mode= via
// window.history.replaceState — the App Router's supported shallow update — so
// switching never re-runs the force-dynamic server page (no recommender/
// embedding re-fetch, no history growth), while useSearchParams keeps the pills
// in sync AND external navigations (e.g. the Home tab's bare /home) naturally
// reset back to Swipe.

const MODES: { id: HomeMode; label: string; Icon: LucideIcon }[] = [
  { id: "swipe", label: "Swipe", Icon: Flame },
  { id: "askAi", label: "Ask AI", Icon: Sparkles },
  { id: "social", label: "Social", Icon: Users },
  { id: "favorites", label: "Favorites", Icon: Heart },
];

export function HomeHub({
  places,
  fetchError,
  initialMode,
}: {
  places: Place[];
  fetchError: string | null;
  initialMode: HomeMode;
}) {
  // Derive the mode straight from the URL. During SSR/first paint the
  // params match what the server page parsed into initialMode (same URL,
  // same parseHomeMode), so hydration stays consistent; initialMode only
  // covers the null-params edge so the fallback never disagrees either.
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlMode: HomeMode = searchParams
    ? parseHomeMode(searchParams.get(HOME_MODE_PARAM) ?? undefined)
    : initialMode;
  // A place/coupon/… detail modal overlays /home by navigating the URL AWAY
  // from /home (intercepting route), which drops the ?mode= param. Without
  // this, useSearchParams would derive `swipe` and the background feed would
  // snap from Social back to Swipe *behind* the opening modal. Cache the last
  // real home mode and keep rendering it while an overlay route is active.
  const onHome = pathname === CONSUMER_ROUTES.home;
  // Adopt the URL mode only while genuinely on /home (React's sanctioned
  // "adjust state during render" pattern); keep the last home mode while an
  // overlay route is active so the feed doesn't flash back to Swipe.
  const [mode, setMode] = useState<HomeMode>(initialMode);
  const [syncedUrlMode, setSyncedUrlMode] = useState<HomeMode>(initialMode);
  if (onHome && urlMode !== syncedUrlMode) {
    setSyncedUrlMode(urlMode);
    setMode(urlMode);
  }

  const selectMode = (next: HomeMode) => {
    if (next === mode) return;
    // Default mode keeps a clean /home; deep links carry ?mode= for the rest.
    const url =
      next === "swipe"
        ? CONSUMER_ROUTES.home
        : `${CONSUMER_ROUTES.home}?${HOME_MODE_PARAM}=${next}`;
    // Shallow update: Next syncs useSearchParams from history.replaceState,
    // so the pill flips as pure client state — no server navigation.
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="from-background to-muted/30 flex h-full min-h-0 flex-col bg-gradient-to-b">
      {/* Mode pill nav — sticky band over a blurred backdrop. */}
      <div className="border-border bg-background/90 sticky top-0 z-20 shrink-0 border-b backdrop-blur-xl">
        <div className="flex items-center gap-1.5 px-3 py-2.5">
          {MODES.map(({ id, label, Icon }) => {
            const active = mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectMode(id)}
                aria-pressed={active}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-semibold transition active:scale-[0.98]",
                  active
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2.2} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Swipe fills the body and owns its gestures — the page itself must
          never scroll in this mode, so the deck gets a clipped flex slot. */}
      {mode === "swipe" && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <SwipeDeck
            places={places}
            fetchError={fetchError}
            errorRetryHref={CONSUMER_ROUTES.home}
          />
        </div>
      )}
      {/* Ask AI (Memo) — full-height inline chat, clipped like the deck so the
          page never scrolls behind the fixed composer. */}
      {mode === "askAi" && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <AskAiTab places={places} />
        </div>
      )}
      {mode === "social" && <SocialFeed places={places} />}
      {mode === "favorites" && <FavoritesList deckPlaces={places} />}
    </div>
  );
}
