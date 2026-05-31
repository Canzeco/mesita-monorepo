"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn, firstInitial } from "@/lib/utils";
import type { Venue } from "@/lib/api/venues";
import { ImageCarousel, type CarouselMediaItem } from "./ImageCarousel";
import { SwipeListingBadge } from "./SwipeCardInfo";
import {
  CarouselPhotoSlide,
  StaticPhotoSlide,
} from "./SwipePhotoSlide";
import {
  SwipeCardFieldsLayer,
  SwipeCardFieldsMeasure,
} from "./SwipeCardFieldsLayer";
import { SWIPE_CARD_FACE } from "./swipe-card-styles";
import { type SwipeCardLayoutMode } from "@/lib/swipe-card-layout";
import { useSwipeCardPhotoLayout } from "@/lib/use-swipe-card-layout";

export function VenueSwipeCardFace({
  venue,
  carousel = false,
  priority = false,
  className,
}: {
  venue: Venue;
  carousel?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const fieldsMeasureRef = useRef<HTMLDivElement>(null);
  const [settledPhotoIdx, setSettledPhotoIdx] = useState(0);

  const { getPhotoLayoutMode, getPhotoLayoutResult, reportPhotoSize, fieldsHeight } =
    useSwipeCardPhotoLayout(venue.photos, cardRef, fieldsMeasureRef);

  const hasPhotos = venue.photos.length > 0;
  const staticPhoto = venue.photos[0];
  const activePhoto = venue.photos[settledPhotoIdx] ?? staticPhoto;
  const activeMode: SwipeCardLayoutMode = activePhoto
    ? getPhotoLayoutMode(activePhoto)
    : "tiwc";
  const layoutDebug = activePhoto ? getPhotoLayoutResult(activePhoto) : null;

  useEffect(() => {
    setSettledPhotoIdx(0);
  }, [venue.id]);

  const reportPhotoSizeAt = useCallback(
    (idx: number, size: { width: number; height: number }) => {
      const src = venue.photos[idx];
      if (src) reportPhotoSize(src, size);
    },
    [venue.photos, reportPhotoSize],
  );

  const renderCarouselSlide = useCallback(
    (idx: number, item: CarouselMediaItem) => {
      if (item.type !== "image") return null;
      return (
        <CarouselPhotoSlide
          src={item.src}
          alt={`${venue.name} photo ${idx + 1}`}
          layoutMode={getPhotoLayoutMode(item.src)}
          fieldsHeight={fieldsHeight}
          priority={priority && idx === 0}
          onNaturalSize={(size) => reportPhotoSize(item.src, size)}
        />
      );
    },
    [venue.name, getPhotoLayoutMode, fieldsHeight, priority, reportPhotoSize],
  );

  return (
    <div
      ref={cardRef}
      data-layout-mode={activeMode}
      className={cn(SWIPE_CARD_FACE, className)}
    >
      <SwipeCardFieldsMeasure venue={venue} measureRef={fieldsMeasureRef} />

      {hasPhotos ? (
        <div className="absolute inset-0">
          <div className="absolute inset-0 z-0">
            {carousel ? (
              <ImageCarousel
                key={venue.id}
                photos={venue.photos}
                alt={venue.name}
                className="absolute inset-0 h-full w-full"
                aspect="h-full"
                priority={priority}
                mutePosition="top-right"
                noNativeScroll
                onIdxSettled={setSettledPhotoIdx}
                onImageNaturalSize={reportPhotoSizeAt}
                renderSlide={renderCarouselSlide}
              />
            ) : (
              staticPhoto && (
                <StaticPhotoSlide
                  src={staticPhoto}
                  alt={venue.name}
                  layoutMode={getPhotoLayoutMode(staticPhoto)}
                  fieldsHeight={fieldsHeight}
                  priority={priority}
                  className="absolute inset-0"
                  onNaturalSize={(size) => reportPhotoSize(staticPhoto, size)}
                />
              )
            )}
          </div>

          <SwipeCardFieldsLayer
            venue={venue}
            mode={activeMode}
            fieldsHeight={fieldsHeight}
          />
        </div>
      ) : (
        <PhotoPlaceholder name={venue.name} />
      )}

      {hasPhotos && (
        <div className="pointer-events-none absolute top-3 left-3 z-20">
          <SwipeListingBadge venue={venue} />
        </div>
      )}

      {hasPhotos && (
        <SwipeCardLayoutDebug layout={layoutDebug} mode={activeMode} />
      )}
    </div>
  );
}

function SwipeCardLayoutDebug({
  layout,
  mode,
}: {
  layout: {
    cardRatio: number;
    imageRatio: number;
    imageCardRatio: number;
  } | null;
  mode: SwipeCardLayoutMode;
}) {
  const fmt = (n: number) => n.toFixed(2);
  return (
    <div className="pointer-events-none absolute inset-x-2 top-2 z-30 flex justify-center">
      <div className="rounded-md bg-black/75 px-2 py-1 font-mono text-[10px] leading-snug text-white shadow-lg backdrop-blur-sm">
        {layout ? (
          <span>
            cardRatio {fmt(layout.cardRatio)} · imageRatio {fmt(layout.imageRatio)} ·
            imageCardRatio {fmt(layout.imageCardRatio)} ·{" "}
            <span className="font-bold uppercase">{mode}</span>
          </span>
        ) : (
          <span>
            ratios pending… · <span className="font-bold uppercase">{mode}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function PhotoPlaceholder({ name }: { name: string }) {
  const initial = firstInitial(name);
  return (
    <div className="bg-pink-gradient absolute inset-0">
      <div className="absolute inset-0 flex items-center justify-center text-white/70">
        <span className="font-display text-7xl font-bold tracking-tight">
          {initial}
        </span>
      </div>
    </div>
  );
}
