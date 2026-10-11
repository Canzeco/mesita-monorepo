"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarCheck,
  Clock,
  Heart,
  MapPin,
  Navigation,
  Share2,
  Star,
} from "lucide-react";

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

// One place, one screen, in THE SWIPE CARD'S SPLIT (Pato, MESITA-2141: "check
// in previous commits in the swipe mode how did cards used to work, then do
// it. like in the gray part you put the info mainly").
//
// THE PHOTO ON TOP, THE PLACE BELOW. The old swipe card (PlaceSwipeCardFace +
// SwipeCardInfo, deleted by MESITA-2105) split square and wide photos into a
// photo band and a fields strip: the name, then a row of chips. This card is
// that split for EVERY photo, on the page's own gray, so the information is
// read on a calm ground instead of over a blurred mirror of the photo. The
// mirror (MESITA-2105's reflection) and the full-bleed scrim are gone.
//
// HIERARCHY: photo, then the name, then Reserve. Reserve is the ONE solid ink
// disc in the action row — the MVP's First Stage is reservations, so it is the
// conversion (Pato, 2026-10-10: "Profile, Save, Share, Reserve").
//
// GESTURES (design 4A): swipe sideways on the photo pages it (the carousel's
// native scroller), double-tap the photo saves, a single tap does nothing.
// The carousel's tap zones are OFF (`tapToPage={false}`) — they would page on
// the first tap of every double tap. The dots are buttons so a mouse can page.
//
// A MOCK CARD (design 3A) gets no `profileHref`: the deck hands it a toast
// instead, and the deck — not this file — decides what Save, Share and Reserve
// do.
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
  onReserve,
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
  const initial = place.name.trim().charAt(0).toUpperCase() || "·";

  const profileBody = (
    <>
      <span className={cn(DISC, "font-display text-lg font-semibold")}>
        {initial}
      </span>
      <span className={LABEL}>Profile</span>
    </>
  );

  return (
    // `h-full` RESOLVES because the scroller is `absolute inset-0` inside a
    // definite box — see ScrollDeck and the layout contract test. Twice now a
    // wrapper has quietly taken that away and the whole feed rendered nothing.
    <li
      aria-label={`${place.name}, ${index + 1} of ${total}`}
      className="bg-background relative flex h-full w-full shrink-0 snap-start snap-always flex-col overflow-hidden"
    >
      <div
        className="bg-foreground relative min-h-0 flex-[11] touch-manipulation overflow-hidden select-none"
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

        {burst > 0 && (
          <Heart
            key={burst}
            aria-hidden
            onAnimationEnd={() => setBurst(0)}
            className="text-on-media drop-shadow-media-lg pointer-events-none absolute top-1/2 left-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 fill-current motion-safe:animate-[scroll-heart-burst_800ms_ease-out_forwards] motion-reduce:hidden"
          />
        )}
      </div>

      {/* THE GRAY PART: the place, then what to do about it. */}
      <div className="flex min-h-0 flex-[9] flex-col gap-2.5 px-4 pt-3.5 pb-3">
        <h2 className="font-display text-foreground truncate text-2xl leading-tight font-semibold tracking-tight">
          {place.name}
        </h2>

        <div className="flex max-h-[58px] flex-wrap gap-1.5 overflow-hidden">
          {category && <Chip>{category}</Chip>}
          {price && <Chip>{price}</Chip>}
          {rating && (
            <Chip>
              <Star className="fill-foreground h-3 w-3 shrink-0" aria-hidden />
              {rating}
              {ratingCount && (
                <span className="text-muted-foreground">({ratingCount})</span>
              )}
            </Chip>
          )}
          {distance && (
            <Chip>
              <Navigation className="h-3 w-3 shrink-0" aria-hidden />
              {distance}
            </Chip>
          )}
          {zone && (
            <Chip>
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              <span className="max-w-[160px] truncate">{zone}</span>
            </Chip>
          )}
          {openState && (
            <Chip>
              <Clock className="h-3 w-3 shrink-0" aria-hidden />
              {openState}
            </Chip>
          )}
        </div>

        {place.pitch && (
          <p className="text-muted-foreground line-clamp-2 text-sm leading-snug [@media(max-height:700px)]:hidden">
            {place.pitch}
          </p>
        )}

        <div className="mt-auto grid grid-cols-4 gap-2 pt-1">
          {profileHref ? (
            <Link
              href={profileHref}
              aria-label={`Open ${place.name}`}
              className={ACTION}
            >
              {profileBody}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onProfile}
              aria-label={`Open ${place.name}`}
              className={ACTION}
            >
              {profileBody}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleSave}
            aria-label={saved ? `Unsave ${place.name}` : `Save ${place.name}`}
            aria-pressed={saved}
            className={ACTION}
          >
            <span className={DISC}>
              <Heart
                className={cn("h-5 w-5", saved && "fill-current")}
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
              <Share2 className="h-5 w-5" strokeWidth={2.1} aria-hidden />
            </span>
            <span className={LABEL}>Share</span>
          </button>

          <button
            type="button"
            onClick={onReserve}
            aria-label={`Reserve at ${place.name}`}
            className={ACTION}
          >
            {/* THE ONE SOLID DISC. */}
            <span
              className={cn(
                DISC,
                "bg-foreground text-background border-foreground",
              )}
            >
              <CalendarCheck
                className="h-5 w-5"
                strokeWidth={2.2}
                aria-hidden
              />
            </span>
            <span className={LABEL}>Reserve</span>
          </button>
        </div>
      </div>
    </li>
  );
}

/** One fact about the place, the old swipe card's chip on the light ground. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-border bg-card text-foreground type-label inline-flex items-center gap-1 rounded-md border px-2 py-[3px] font-semibold whitespace-nowrap tabular-nums">
      {children}
    </span>
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
  "text-foreground flex flex-col items-center gap-1 rounded-full focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

const DISC =
  "border-border bg-card flex h-11 w-11 items-center justify-center rounded-full border transition-transform active:scale-95";

const LABEL = "text-xs font-semibold";

// One slide: the photo covers its band. A dead photo URL renders the same ink
// placeholder as a place with no photos, never a broken image.
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
  const loading = priority ? undefined : eager ? "eager" : "lazy";
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 100vw, 480px"
      priority={priority}
      loading={loading}
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
