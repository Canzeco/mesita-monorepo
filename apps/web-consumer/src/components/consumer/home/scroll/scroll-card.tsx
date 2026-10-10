"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Share2, Zap } from "lucide-react";

import type { Place } from "@/lib/api/places";
import { resolveZoneLabel } from "@/lib/adapters/place-to-detail";
import { resolvePlaceCategoryName } from "@/lib/place-category";
import { formatPlacePriceLevelSymbols } from "@/lib/place-price";
import { getOpeningStateLabel } from "@/lib/place-state";
import { isPartner } from "@/lib/promo-rates";
import {
  cn,
  formatCompactCount,
  formatDistanceKm,
  formatRating,
} from "@/lib/utils";
import { ImageCarousel } from "@/components/consumer/ImageCarousel";
import { PartnerMark } from "@/components/consumer/PartnerMark";
import { useDoubleTap } from "./use-double-tap";

// One place, one screen, TikTok's grammar (MESITA-2105, design 1A).
//
// THE PHOTO OWNS THE SCREEN. No card chrome, no gutter, no radius, no peek:
// the card is the full box between the mode rail and the tab bar. This
// replaces the 2026-09-08 card, which kept a rounded frame and an action row
// UNDER the photo because white glyphs on a bright photo fail 4.5:1. The
// answer to that is the glass below, not the frame: every action sits on a
// `bg-media-glass` disc, and white on 55% black stays at 4.74:1 even over a
// pure-white photo.
//
// HIERARCHY: photo, then the name, then Go. Go is the ONE solid white disc in
// the column — `useStartVisit` behind it is still the only path in this app
// that creates a ticket, so the conversion must read third and nothing else
// may compete with it.
//
// GESTURES (design 4A): swipe sideways pages the photos (the carousel's native
// scroller), double-tap saves, a single tap does nothing. The carousel's tap
// zones are OFF here (`tapToPage={false}`) — they would page on the first tap
// of every double tap. The dots are buttons so a mouse can still page.
//
// THE AVATAR IS THE PROFILE LINK now, top of the column, the way every vertical
// feed links to the account behind a post. The name stopped being the link
// when the tap zones stopped covering the card.
//
// A MOCK CARD (design 3A) gets no `profileHref`: the deck hands it a toast
// instead, and the deck — not this file — decides what Save, Share and Go do.
export function ScrollCard({
  place,
  index,
  total,
  near,
  priority = false,
  saved,
  profileHref,
  onProfile,
  onToggleSave,
  onShare,
  onGo,
}: {
  place: Place;
  index: number;
  total: number;
  /** Within one card of the one on screen: only these load photos eagerly
   *  (eng review R3). Everything else is `loading="lazy"`. */
  near: boolean;
  priority?: boolean;
  saved: boolean;
  /** The place page, or null for a card that has none (a mock). */
  profileHref: string | null;
  /** Used when `profileHref` is null. */
  onProfile: () => void;
  onToggleSave: () => void;
  onShare: () => void;
  onGo: () => void;
}) {
  // A key, not a boolean: every double tap remounts the heart so the burst
  // replays even when the place is already saved.
  const [burst, setBurst] = useState(0);
  const doubleTap = useDoubleTap(() => {
    // Double tap only ever SAVES — it never unsaves, the same as every feed
    // that taught guests the gesture.
    if (!saved) onToggleSave();
    setBurst((n) => n + 1);
  });

  const partner = isPartner(place);
  const category = resolvePlaceCategoryName({
    categoryLabel: place.category_label,
    category: place.category,
  });
  const price = formatPlacePriceLevelSymbols(place.price_level);
  const zone = resolveZoneLabel({ zone: place.zone, address: place.address });
  // 0 is withUserDistance's "no coordinates" placeholder, not "you are here".
  const distance =
    place.distance_km != null && place.distance_km > 0
      ? formatDistanceKm(place.distance_km)
      : null;
  const rating = formatRating(place.google_rating);
  const ratingCount =
    place.google_count != null ? formatCompactCount(place.google_count) : null;
  const openState = getOpeningStateLabel(place);
  const metaLine = [category, price, zone, distance].filter(Boolean).join(" · ");
  const initial = place.name.trim().charAt(0).toUpperCase() || "·";

  return (
    // `h-full` RESOLVES because the scroller is `absolute inset-0` inside a
    // definite box — see ScrollDeck and the layout contract test. Twice now a
    // wrapper has quietly taken that away and the whole feed rendered nothing.
    <li
      aria-label={`${place.name}, ${index + 1} of ${total}`}
      className="bg-foreground relative h-full w-full shrink-0 snap-start snap-always overflow-hidden"
    >
      <div
        className="absolute inset-0 touch-manipulation select-none"
        {...doubleTap}
      >
        {place.photos.length > 0 ? (
          <ImageCarousel
            photos={place.photos}
            alt={place.name}
            aspect=""
            className="h-full"
            tapToPage={false}
            interactiveDots
            renderSlide={(i, item, { inPreloadWindow }) => (
              <ScrollSlide
                src={item.src}
                alt={`${place.name}, photo ${i + 1} of ${place.photos.length}`}
                initial={initial}
                priority={priority && i === 0}
                eager={near && inPreloadWindow}
              />
            )}
          />
        ) : (
          <PhotoPlaceholder initial={initial} />
        )}
      </div>

      <div className="bg-media-scrim pointer-events-none absolute inset-x-0 bottom-0 h-3/5" />

      {burst > 0 && (
        <Heart
          key={burst}
          aria-hidden
          onAnimationEnd={() => setBurst(0)}
          className="text-on-media drop-shadow-media-lg pointer-events-none absolute top-1/2 left-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 fill-current motion-safe:animate-[scroll-heart-burst_800ms_ease-out_forwards] motion-reduce:hidden"
        />
      )}

      <div className="text-on-media pointer-events-none absolute bottom-0 left-0 right-[72px] flex flex-col gap-1 p-4 pb-5">
        <h2 className="font-display flex min-w-0 items-center gap-1.5 text-2xl leading-tight font-semibold [text-shadow:0_2px_12px_rgba(0,0,0,0.62)]">
          <span className="truncate">{place.name}</span>
          {partner && (
            <PartnerMark className="text-partner h-5 w-5 shrink-0" />
          )}
        </h2>
        {metaLine && (
          <p className="text-on-media-muted truncate text-sm font-medium">
            {metaLine}
          </p>
        )}
        {(rating || openState) && (
          <p className="text-on-media-muted truncate text-sm font-medium tabular-nums">
            {rating && (
              <>
                ★ {rating}
                {ratingCount && ` (${ratingCount})`}
              </>
            )}
            {rating && openState && " · "}
            {openState}
          </p>
        )}
        {place.pitch && (
          <p className="text-on-media-muted line-clamp-2 text-sm leading-snug [@media(max-height:640px)]:hidden">
            {place.pitch}
          </p>
        )}
      </div>

      <div className="absolute right-3 bottom-5 flex flex-col items-center gap-3 [@media(max-height:640px)]:gap-2">
        {profileHref ? (
          <Link
            href={profileHref}
            aria-label={`Open ${place.name}`}
            className={cn(ACTION, "font-display text-lg font-semibold")}
          >
            <span className={DISC}>{initial}</span>
            <span className={LABEL}>Profile</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={onProfile}
            aria-label={`Open ${place.name}`}
            className={cn(ACTION, "font-display text-lg font-semibold")}
          >
            <span className={DISC}>{initial}</span>
            <span className={LABEL}>Profile</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleSave}
          aria-label={saved ? `Unsave ${place.name}` : `Save ${place.name}`}
          aria-pressed={saved}
          className={ACTION}
        >
          <span className={cn(DISC, saved && "scale-110")}>
            <Heart
              className={cn("h-6 w-6", saved && "fill-current")}
              strokeWidth={2.1}
              aria-hidden
            />
          </span>
          <span className={LABEL}>{saved ? "Saved" : "Save"}</span>
        </button>

        <button
          type="button"
          onClick={onShare}
          aria-label={`Share ${place.name}`}
          className={ACTION}
        >
          <span className={DISC}>
            <Share2 className="h-6 w-6" strokeWidth={2.1} aria-hidden />
          </span>
          <span className={LABEL}>Share</span>
        </button>

        <button
          type="button"
          onClick={onGo}
          aria-label={`Go to ${place.name}`}
          className={ACTION}
        >
          {/* THE ONE INVERTED DISC. */}
          <span
            className={cn(
              DISC,
              "bg-on-media text-foreground backdrop-blur-none",
            )}
          >
            <Zap className="h-6 w-6" strokeWidth={2.2} aria-hidden />
          </span>
          <span className={LABEL}>Go</span>
        </button>
      </div>
    </li>
  );
}

/** What a mock card says when you ask it for something real (design 3A). */
export const SAMPLE_PLACE_TOAST = "Sample place — real places land here soon";

/**
 * Where each of a card's actions goes. ONE function decides it for every card,
 * so the rule that a mock place never reaches real data lives in one place and
 * one test (design 3A, eng review 1.2):
 *
 *   mock → Save toggles in-memory state only; Profile, Share and Go toast.
 *          Nothing touches Favs, analytics, a place URL or a ticket.
 *   real → today's behaviour: the Favs store (+ first-save toast and the
 *          `home_card_save` event), the place page, the share sheet, and
 *          GoSheet behind `home_card_open`.
 */
export function scrollCardActions(
  place: Place,
  position: number,
  deps: {
    isMock: boolean;
    savedIds: ReadonlySet<string>;
    mockSavedIds: ReadonlySet<string>;
    toast: (message: string) => void;
    saveReal: (place: Place, saved: boolean) => void;
    setMockSaved: (id: string, saved: boolean) => void;
    track: (
      event: "home_card_save" | "home_card_open",
      props: Record<string, string | number>,
    ) => void;
    share: (place: Place) => void;
    openGo: (place: Place) => void;
    profileHref: (place: Place) => string;
  },
) {
  const sample = () => deps.toast(SAMPLE_PLACE_TOAST);
  if (deps.isMock) {
    const saved = deps.mockSavedIds.has(place.id);
    return {
      saved,
      profileHref: null,
      onProfile: sample,
      onToggleSave: () => deps.setMockSaved(place.id, !saved),
      onShare: sample,
      onGo: sample,
    };
  }
  const saved = deps.savedIds.has(place.id);
  return {
    saved,
    profileHref: deps.profileHref(place),
    onProfile: () => {},
    onToggleSave: () => {
      deps.saveReal(place, !saved);
      if (!saved) {
        deps.track("home_card_save", { mode: "scroll", place_id: place.id });
      }
    },
    onShare: () => deps.share(place),
    onGo: () => {
      // Go is the conversion intent; `ticket_created` fires later from
      // useStartVisit and joins to this through the place.
      deps.track("home_card_open", {
        mode: "scroll",
        place_id: place.id,
        position,
      });
      deps.openGo(place);
    },
  };
}

const ACTION =
  "text-on-media flex flex-col items-center gap-1 rounded-full focus-visible:ring-2 focus-visible:ring-on-media focus-visible:ring-offset-2 focus-visible:ring-offset-foreground focus-visible:outline-none";
const DISC =
  "bg-media-glass flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-md transition-transform active:scale-95";
const LABEL = "drop-shadow-media text-xs font-semibold";

// One slide. The default slide has no error path, and a dead photo URL would
// render a broken image across a whole screen; this one falls back to the
// same ink placeholder a place with no photos gets.
function ScrollSlide({
  src,
  alt,
  initial,
  priority,
  eager,
}: {
  src: string;
  alt: string;
  initial: string;
  priority: boolean;
  eager: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <PhotoPlaceholder initial={initial} />;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 100vw, 480px"
      priority={priority}
      loading={priority ? undefined : eager ? "eager" : "lazy"}
      draggable={false}
      onError={() => setFailed(true)}
      className="object-cover select-none [-webkit-user-drag:none]"
    />
  );
}

function PhotoPlaceholder({ initial }: { initial: string }) {
  return (
    <div className="bg-foreground flex h-full w-full items-center justify-center">
      <span className="font-display text-on-media-muted text-7xl font-semibold">
        {initial}
      </span>
    </div>
  );
}
