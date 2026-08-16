"use client";

import { useCallback, useRef, useState } from "react";
import { cn, firstInitial } from "@/lib/utils";
import type { Place } from "@/lib/api/places";
import { ImageCarousel, type CarouselMediaItem } from "./ImageCarousel";
import { CarouselPhotoSlide, StaticPhotoSlide } from "./SwipePhotoSlide";
import {
  SwipeCardFieldsLayer,
  SwipeCardFieldsMeasure,
} from "./SwipeCardFieldsLayer";
import { SWIPE_CARD_FACE } from "./swipe-card-styles";
import { type SwipeCardLayoutMode } from "@/lib/swipe-card-layout";
import { useSwipeCardPhotoLayout } from "@/lib/use-swipe-card-layout";

export function PlaceSwipeCardFace({
  place,
  carousel = false,
  priority = false,
  className,
}: {
  place: Place;
  carousel?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const fieldsMeasureRef = useRef<HTMLDivElement>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const { getPhotoLayoutMode, reportPhotoSize, fieldsHeight } =
    useSwipeCardPhotoLayout(place.photos, cardRef, fieldsMeasureRef);

  const hasPhotos = place.photos.length > 0;
  const staticPhoto = place.photos[0];
  const activePhoto = place.photos[activePhotoIdx] ?? staticPhoto;
  const activeMode: SwipeCardLayoutMode = activePhoto
    ? getPhotoLayoutMode(activePhoto)
    : "tiwc";

  const reportPhotoSizeAt = useCallback(
    (idx: number, size: { width: number; height: number }) => {
      const src = place.photos[idx];
      if (src) reportPhotoSize(src, size);
    },
    [place.photos, reportPhotoSize],
  );

  const renderCarouselSlide = useCallback(
    (idx: number, item: CarouselMediaItem) => {
      if (item.type !== "image") return null;
      return (
        <CarouselPhotoSlide
          src={item.src}
          alt={`${place.name} photo ${idx + 1}`}
          layoutMode={getPhotoLayoutMode(item.src)}
          fieldsHeight={fieldsHeight}
          priority={priority && idx === 0}
          onNaturalSize={(size) => reportPhotoSize(item.src, size)}
        />
      );
    },
    [place.name, getPhotoLayoutMode, fieldsHeight, priority, reportPhotoSize],
  );

  return (
    <div
      ref={cardRef}
      data-layout-mode={activeMode}
      className={cn(SWIPE_CARD_FACE, className)}
    >
      <SwipeCardFieldsMeasure place={place} measureRef={fieldsMeasureRef} />

      {hasPhotos ? (
        <div className="absolute inset-0">
          <div className="absolute inset-0 z-0">
            {carousel ? (
              <ImageCarousel
                key={place.id}
                photos={place.photos}
                alt={place.name}
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
                  alt={place.name}
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
            place={place}
            mode={activeMode}
            fieldsHeight={fieldsHeight}
          />
        </div>
      ) : (
        <PhotoPlaceholder name={place.name} />
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
