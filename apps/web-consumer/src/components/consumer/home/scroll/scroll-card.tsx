"use client";

import Link from "next/link";
import { ChevronRight, Heart, Share2, Zap } from "lucide-react";

import type { Place } from "@/lib/api/places";
import { cn } from "@/lib/utils";
import { placeHref } from "@/lib/place-route";
import { sharePlace } from "@/lib/share-place";
import { PlaceSwipeCardFace } from "@/components/consumer/PlaceSwipeCardFace";

// One place, one screen.
//
// THE CARD KEEPS ITS CHROME. `rounded-3xl` and the 12px page gutter stay — a
// 2xl corner radius flush against the frame reads as a clipped render, which
// is the same reason PLACE_GRID_PAGE_CLASS carries padding rather than sitting
// edge to edge. "Full-bleed" here means one card fills the space between the
// mode rail and the tab bar, not that it runs under them.
//
// FOUR ACTIONS, IN A ROW UNDER THE CARD: Save · Go · Share · Profile.
//
// They sit on the card's own ground rather than floating over the photo. Reels
// can float white glyphs because it is dark chrome over dark video; this app
// is light-theme only, and an outline icon floating on a bright photo is the
// 4.5:1 contrast failure the package rules pin. A row below the photo has a
// solid surface and cannot fail that way.
//
// GO IS THE ONE THAT MATTERS. It opens the Visit · Order · Reserve sheet, and
// `useStartVisit` behind it is the only path in this app that creates a
// ticket. Save and Share are both bookmarks in different clothes; without Go
// this surface — the app's default screen — could not convert at all.
//
// THE NAME IS THE PROFILE LINK, and that is forced, not stylistic: the card
// face mounts an ImageCarousel whose tap zones cover the WHOLE card whenever a
// place has more than one photo, so a tap already means "next photo". The
// title carries the chevron and the 44px target instead. No long-press —
// nothing else in this app uses one.
export function ScrollCard({
  place,
  priority = false,
  peek = false,
  saved,
  onToggleSave,
  onGo,
}: {
  place: Place;
  priority?: boolean;
  /** First card only: leave the next one visible under the fold. */
  peek?: boolean;
  saved: boolean;
  onToggleSave: () => void;
  onGo: () => void;
}) {
  return (
    <li
      className={cn(
        "flex snap-start snap-always shrink-0 flex-col gap-2",
        // See ScrollDeck's note — this is what makes 50 rows scroll.
        "[content-visibility:auto] [contain-intrinsic-size:auto_70vh]",
        peek ? "h-[88%]" : "h-full",
      )}
    >
      <div className="relative min-h-0 flex-1">
        <PlaceSwipeCardFace
          place={place}
          carousel
          priority={priority}
          forceLayoutMode="tiwc"
          className="h-full w-full"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={placeHref(place.slug ?? place.id)}
          className="border-border bg-card text-foreground flex h-11 min-w-0 flex-1 items-center gap-1 rounded-full border px-4 text-sm font-semibold transition active:scale-[0.98]"
        >
          <span className="truncate">{place.name}</span>
          <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
        </Link>

        <ActionButton
          label={saved ? `Unsave ${place.name}` : `Save ${place.name}`}
          onClick={onToggleSave}
          pressed={saved}
          // Save is the ONLY colour in this row, and the fill plus the one-shot
          // scale is the whole confirmation — the stack deck stamped the card
          // and a scroll has nowhere to put a stamp. A heart that changes
          // silently is the weakest possible receipt for the action three of
          // Home's four tabs depend on.
          className={cn(
            saved
              ? "border-primary bg-primary text-primary-foreground shadow-glow scale-105"
              : "border-border bg-card text-foreground",
          )}
        >
          <Heart
            className={cn("h-5 w-5", saved && "fill-current")}
            strokeWidth={2.1}
            aria-hidden
          />
        </ActionButton>

        <ActionButton
          label={`Share ${place.name}`}
          onClick={() => void sharePlace(place)}
          className="border-border bg-card text-foreground"
        >
          <Share2 className="h-5 w-5" strokeWidth={2.1} aria-hidden />
        </ActionButton>

        <ActionButton
          label={`Go to ${place.name}`}
          onClick={onGo}
          className="border-foreground bg-foreground text-background"
        >
          <Zap className="h-5 w-5" strokeWidth={2.2} aria-hidden />
        </ActionButton>
      </div>
    </li>
  );
}

function ActionButton({
  label,
  onClick,
  pressed,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-[0.94]",
        className,
      )}
    >
      {children}
    </button>
  );
}
