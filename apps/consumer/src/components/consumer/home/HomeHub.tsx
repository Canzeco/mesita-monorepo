"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Heart, Users, type LucideIcon } from "lucide-react";
import { SwipeDeck } from "@/app/(shell)/discover/swipe/SwipeDeck";
import type { Place } from "@/lib/api/places";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { HOME_MODE_PARAM, type HomeMode } from "./home-mode";
import { SocialFeed } from "./SocialFeed";
import { FavoritesList } from "./FavoritesList";

// The /home hub client. Receives the server-fetched deck once and flips
// between the three modes as pure client state — no route change, no
// refetch on switch. The shell renders no TopBar for /home, so the pill
// mode nav below IS the page's top chrome.
//
// Swipe sits center (it's the default and the tab's identity); Social and
// Favorites flank it. URL stays shareable via ?mode= — written with
// router.replace so switching modes never grows history or scrolls.

const MODES: { id: HomeMode; label: string; Icon: LucideIcon }[] = [
  { id: "social", label: "Social", Icon: Users },
  { id: "swipe", label: "Swipe", Icon: Flame },
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
  const router = useRouter();
  const [mode, setMode] = useState<HomeMode>(initialMode);

  const selectMode = (next: HomeMode) => {
    if (next === mode) return;
    setMode(next);
    // Default mode keeps a clean /home; deep links carry ?mode= for the rest.
    const url =
      next === "swipe"
        ? CONSUMER_ROUTES.home
        : `${CONSUMER_ROUTES.home}?${HOME_MODE_PARAM}=${next}`;
    router.replace(url, { scroll: false });
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
          <SwipeDeck places={places} fetchError={fetchError} />
        </div>
      )}
      {mode === "social" && <SocialFeed places={places} />}
      {mode === "favorites" && <FavoritesList deckPlaces={places} />}
    </div>
  );
}
