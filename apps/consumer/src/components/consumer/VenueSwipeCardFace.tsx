"use client";

import { useCallback, useRef, useState } from "react";
import { cn, firstInitial } from "@/lib/utils";
import type { Venue } from "@/lib/api/venues";
import { ImageCarousel, type CarouselMediaItem } from "./ImageCarousel";
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
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const {
    getPhotoLayoutMode,
    getPhotoLayoutResult,
    reportPhotoSize,
    fieldsHeight,
  } = useSwipeCardPhotoLayout(venue.photos, cardRef, fieldsMeasureRef);

  const hasPhotos = venue.photos.length > 0;
  const staticPhoto = venue.photos[0];
  const activePhoto = venue.photos[activePhotoIdx] ?? staticPhoto;
  const activeMode: SwipeCardLayoutMode = activePhoto
    ? getPhotoLayoutMode(activePhoto)
    : "tiwc";

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
    [
      venue.name,
      getPhotoLayoutMode,
      fieldsHeight,
      priority,
      reportPhotoSize,
    ],
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
                onIdxChange={setActivePhotoIdx}
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
