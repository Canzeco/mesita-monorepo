"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, Heart, Share2 } from "lucide-react";

import type { Place } from "@/lib/api/places";
import { resolveZoneLabel } from "@/lib/adapters/place-to-detail";
import { resolvePlaceCategoryName } from "@/lib/place-category";
import { formatPlacePriceLevelSymbols } from "@/lib/place-price";
import { getOpeningStateLabel } from "@/lib/place-state";
import {
  cn,
  formatCompactCount,
  formatDistanceKm,
  formatRating,
} from "@/lib/utils";
import { ImageCarousel } from "@/components/consumer/ImageCarousel";
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
// HIERARCHY: photo, then the name, then Reserve. Reserve is the ONE solid white
// disc in the column — the MVP's First Stage is reservations, so it is the
// conversion and must read third with nothing competing (Pato, 2026-10-10:
// "Profile, Save, Share, Reserve"; it replaced Go and its visit/order doors).
//
// SQUARE AND WIDE PHOTOS WEAR THE REFLECTION (Pato: "use the reflection thing
// that swipe used to have, because squares"). A photo much wider than the card
// would lose most of itself to `object-cover`; instead it sits uncropped in a
// top band and a mirrored, blurred, darkened copy fills the space below, where
// the name sits. Tall photos still cover the whole card. See ScrollSlide.
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
// instead, and the deck — not this file — decides what Save, Share and Reserve
// do.
export function ScrollCard({
  place,
  index,
  total,
  near,
  cardSize = null,
  priority = false,
  saved,
  profileHref,
  onProfile,
  onToggleSave,
  onShare,
  onReserve,
}: {
  place: Place;
  index: number;
  total: number;
  /** Within one card of the one on screen: only these load photos eagerly
   *  (eng review R3). Everything else is `loading="lazy"`. */
  near: boolean;
  /** The card's box (the scrollport). Unknown until measured; until then
   *  every photo covers the card. */
  cardSize?: { width: number; height: number } | null;
  priority?: boolean;
  saved: boolean;
  /** The place page, or null for a card that has none (a mock). */
  profileHref: string | null;
  /** Used when `profileHref` is null. */
  onProfile: () => void;
  onToggleSave: () => void;
  onShare: () => void;
  onReserve: () => void;
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
                cardSize={cardSize}
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
          onClick={onReserve}
          aria-label={`Reserve at ${place.name}`}
          className={ACTION}
        >
          {/* THE ONE INVERTED DISC. */}
          <span
            className={cn(
              DISC,
              "bg-on-media text-foreground backdrop-blur-none",
            )}
          >
            <CalendarCheck className="h-6 w-6" strokeWidth={2.2} aria-hidden />
          </span>
          <span className={LABEL}>Reserve</span>
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
 *   mock → Save toggles in-memory state only; Profile, Share and Reserve
 *          toast. Nothing touches Favs, analytics, a place URL or a booking.
 *   real → the Favs store (+ first-save toast and the `home_card_save`
 *          event), the place page, the share sheet, and the reservation
 *          sheet behind `home_card_open`.
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
    openReserve: (place: Place) => void;
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
      onReserve: sample,
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
    onReserve: () => {
      // Reserve is the conversion intent; the event name predates it (it
      // tracked Go) and stays, so the funnel keeps one series.
      deps.track("home_card_open", {
        mode: "scroll",
        place_id: place.id,
        position,
      });
      deps.openReserve(place);
    },
  };
}

const ACTION =
  "text-on-media flex flex-col items-center gap-1 rounded-full focus-visible:ring-2 focus-visible:ring-on-media focus-visible:ring-offset-2 focus-visible:ring-offset-foreground focus-visible:outline-none";
const DISC =
  "bg-media-glass flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-md transition-transform active:scale-95";
const LABEL = "drop-shadow-media text-xs font-semibold";

/** A photo at least this much wider than the card (photo aspect ÷ card
 *  aspect) wears the reflection instead of covering the card. The old swipe
 *  card's number: 9:16, 3:4 and most 4:5 photos still cover a phone card;
 *  square and wider get the band. */
const REFLECTION_THRESHOLD = 1.32;
/** The reflection never gets shorter than this, so the name, the meta and
 *  the pitch always sit on it rather than on the photo. */
export const REFLECTION_MIN_PX = 152;

/** Whether a photo of `imageRatio` (w ÷ h) wears the reflection in a card of
 *  `card` size. */
export function needsReflection(
  imageRatio: number,
  card: { width: number; height: number },
): boolean {
  const cardRatio = card.width / Math.max(card.height, 1);
  return imageRatio / cardRatio >= REFLECTION_THRESHOLD;
}

/** The photo band's height: the photo uncropped at full width, held between
 *  two floors. Never under half the card, because the reflection is a mirror
 *  of the band and can only fill as much as the band is tall (a 3:2 photo at
 *  its natural 260px would leave 411px below with 151px of nothing); never
 *  over the card minus REFLECTION_MIN_PX, so the name always sits on the
 *  reflection. A square photo shows whole; 3:2 gives up ~22% of its width. */
export function reflectionBandHeight(
  imageRatio: number,
  card: { width: number; height: number },
): number {
  const natural = card.width / imageRatio;
  return Math.max(
    0,
    Math.min(Math.max(natural, card.height / 2), card.height - REFLECTION_MIN_PX),
  );
}

// One slide. It covers the card until it knows better: once the photo loads
// and the card is measured, a square or wide photo switches to the reflection.
// A dead photo URL renders the same ink placeholder as a place with no photos,
// never a broken image across a whole screen.
function ScrollSlide({
  src,
  alt,
  initial,
  priority,
  eager,
  cardSize,
}: {
  src: string;
  alt: string;
  initial: string;
  priority: boolean;
  eager: boolean;
  cardSize: { width: number; height: number } | null;
}) {
  const [failed, setFailed] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);
  if (failed) return <PhotoPlaceholder initial={initial} />;
  const loading = priority ? undefined : eager ? "eager" : "lazy";
  if (ratio && cardSize && needsReflection(ratio, cardSize)) {
    return (
      <ReflectedPhoto
        src={src}
        alt={alt}
        bandHeight={reflectionBandHeight(ratio, cardSize)}
        priority={priority}
        loading={loading}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 100vw, 480px"
      priority={priority}
      loading={loading}
      draggable={false}
      onLoad={(e) => {
        const img = e.currentTarget;
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          setRatio(img.naturalWidth / img.naturalHeight);
        }
      }}
      onError={() => setFailed(true)}
      className="object-cover select-none [-webkit-user-drag:none]"
    />
  );
}

/**
 * The photo uncropped in a top band, and below it the same photo flipped
 * about the seam, blurred and darkened — the old swipe card's square-photo
 * mode, carried over (its "WITC" band + reflective strip).
 *
 * A FLIPPED COPY, NOT `-webkit-box-reflect`: that property silently fails on
 * iOS Safari inside composited layers and never rendered on Firefox. The copy
 * is a box exactly the band's size placed right under it and flipped about
 * its own centre, so its top edge shows the band's bottom edge: the seam
 * lines up with no measurement of the image itself.
 */
export function ReflectedPhoto({
  src,
  alt,
  bandHeight,
  priority = false,
  loading,
  onError,
}: {
  src: string;
  alt: string;
  bandHeight: number;
  priority?: boolean;
  loading?: "eager" | "lazy";
  onError?: () => void;
}) {
  const sizes = "(max-width: 768px) 100vw, 480px";
  return (
    <div className="bg-foreground relative h-full w-full overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 overflow-hidden"
        style={{ height: bandHeight }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : loading}
          draggable={false}
          onError={onError}
          className="object-cover object-bottom select-none [-webkit-user-drag:none]"
        />
      </div>
      <div
        aria-hidden
        data-reflection
        className="pointer-events-none absolute inset-x-0 overflow-hidden [transform:scaleY(-1)]"
        style={{ top: bandHeight, height: bandHeight }}
      >
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          loading={priority ? undefined : loading}
          draggable={false}
          className="object-cover object-bottom select-none"
        />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{ top: bandHeight }}
      >
        <div className="absolute inset-0 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/22 to-black/64" />
      </div>
    </div>
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
