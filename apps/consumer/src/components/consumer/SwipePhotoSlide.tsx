"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { isSplitLayout, type SwipeCardLayoutMode } from "@/lib/swipe-card-layout";
import {
  readPhotoNaturalSize,
  type ImageNaturalSize,
} from "@/lib/use-swipe-card-layout";
import {
  SWIPE_CARD_COVER_PHOTO,
  SWIPE_CARD_WITC_PHOTO_BAND,
  SWIPE_CARD_FIELDS_STRIP,
} from "./swipe-card-styles";

/**
 * TIWC — cover over the full card.
 * WITC — cover in the top band only; blue strip below (fields in SwipeCardFieldsLayer).
 */
export function CarouselPhotoSlide({
  src,
  alt,
  layoutMode,
  fieldsHeight,
  className,
  onNaturalSize,
}: {
  src: string;
  alt: string;
  layoutMode: SwipeCardLayoutMode;
  fieldsHeight: number;
  priority?: boolean;
  className?: string;
  onNaturalSize?: (size: ImageNaturalSize) => void;
}) {
  if (isSplitLayout(layoutMode)) {
    return (
      <WitcPhotoSlide
        src={src}
        alt={alt}
        fieldsHeight={fieldsHeight}
        className={className}
        onNaturalSize={onNaturalSize}
      />
    );
  }

  return (
    <TiwcPhotoSlide
      src={src}
      alt={alt}
      className={className}
      onNaturalSize={onNaturalSize}
    />
  );
}

export function StaticPhotoSlide({
  src,
  alt,
  layoutMode,
  fieldsHeight,
  className,
  onNaturalSize,
}: {
  src: string;
  alt: string;
  layoutMode: SwipeCardLayoutMode;
  fieldsHeight: number;
  priority?: boolean;
  className?: string;
  onNaturalSize?: (size: ImageNaturalSize) => void;
}) {
  if (isSplitLayout(layoutMode)) {
    return (
      <WitcPhotoSlide
        src={src}
        alt={alt}
        fieldsHeight={fieldsHeight}
        className={className}
        onNaturalSize={onNaturalSize}
      />
    );
  }

  return (
    <TiwcPhotoSlide
      src={src}
      alt={alt}
      className={className}
      onNaturalSize={onNaturalSize}
    />
  );
}

/** WITC — top photo band + vertically mirrored strip below. */
function WitcPhotoSlide({
  src,
  alt,
  fieldsHeight,
  className,
  onNaturalSize,
}: {
  src: string;
  alt: string;
  fieldsHeight: number;
  className?: string;
  onNaturalSize?: (size: ImageNaturalSize) => void;
}) {
  const stripHeight = Math.max(fieldsHeight, 1);
  const reflectStyle: CSSProperties = {
    WebkitBoxReflect:
      "below 0px linear-gradient(to bottom, rgba(0,0,0,0.58), rgba(0,0,0,0.9))",
  };

  return (
    <div className={cn("flex h-full w-full flex-col overflow-hidden", className)}>
      <div className={SWIPE_CARD_WITC_PHOTO_BAND} style={reflectStyle}>
        <CoverImage
          src={src}
          alt={alt}
          onNaturalSize={onNaturalSize}
          className="h-full w-full object-bottom"
        />
      </div>
      <div
        className={SWIPE_CARD_FIELDS_STRIP}
        style={{ height: stripHeight }}
        aria-hidden
      >
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/15 to-black/55" />
      </div>
    </div>
  );
}

/** TIWC — image cover over the entire card. */
function TiwcPhotoSlide({
  src,
  alt,
  className,
  onNaturalSize,
}: {
  src: string;
  alt: string;
  className?: string;
  onNaturalSize?: (size: ImageNaturalSize) => void;
}) {
  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <CoverImage
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full"
        onNaturalSize={onNaturalSize}
      />
    </div>
  );
}

function CoverImage({
  src,
  alt,
  className,
  onNaturalSize,
  style,
}: {
  src: string;
  alt: string;
  className?: string;
  onNaturalSize?: (size: ImageNaturalSize) => void;
  style?: CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={false}
      loading="eager"
      decoding="async"
      onLoad={
        onNaturalSize
          ? (event) => {
              const size = readPhotoNaturalSize(event.currentTarget);
              if (size) onNaturalSize(size);
            }
          : undefined
      }
      className={cn(
        "h-full w-full select-none [-webkit-user-drag:none]",
        SWIPE_CARD_COVER_PHOTO,
        className,
      )}
      style={style}
    />
  );
}
