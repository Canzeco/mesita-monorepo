"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
  isSplitLayout,
  type SwipeCardLayoutMode,
} from "@/lib/swipe-card-layout";
import {
  readPhotoNaturalSize,
  type ImageNaturalSize,
} from "@/lib/use-swipe-card-layout";
import {
  SWIPE_CARD_COVER_PHOTO,
  SWIPE_CARD_WITC_PHOTO_BAND,
  SWIPE_CARD_FIELDS_STRIP,
  SWIPE_CARD_WITC_FIELDS_TARGET_H,
} from "./swipe-card-styles";

type PhotoSlideProps = {
  src: string;
  alt: string;
  layoutMode: SwipeCardLayoutMode;
  fieldsHeight: number;
  priority?: boolean;
  className?: string;
  onNaturalSize?: (size: ImageNaturalSize) => void;
};

/**
 * TIWC — cover over the full card.
 * WITC — cover in the top band only; blue strip below (fields in SwipeCardFieldsLayer).
 */
function PhotoSlide({
  src,
  alt,
  layoutMode,
  fieldsHeight,
  priority,
  className,
  onNaturalSize,
}: PhotoSlideProps) {
  if (isSplitLayout(layoutMode)) {
    return (
      <WitcPhotoSlide
        src={src}
        alt={alt}
        fieldsHeight={fieldsHeight}
        priority={priority}
        className={className}
        onNaturalSize={onNaturalSize}
      />
    );
  }

  return (
    <TiwcPhotoSlide
      src={src}
      alt={alt}
      priority={priority}
      className={className}
      onNaturalSize={onNaturalSize}
    />
  );
}

export function CarouselPhotoSlide(props: PhotoSlideProps) {
  return <PhotoSlide {...props} />;
}

export function StaticPhotoSlide(props: PhotoSlideProps) {
  return <PhotoSlide {...props} />;
}

/** WITC — top photo band + vertically mirrored strip below. */
function WitcPhotoSlide({
  src,
  alt,
  fieldsHeight,
  priority,
  className,
  onNaturalSize,
}: {
  src: string;
  alt: string;
  fieldsHeight: number;
  priority?: boolean;
  className?: string;
  onNaturalSize?: (size: ImageNaturalSize) => void;
}) {
  const stripHeight = Math.max(
    Math.min(fieldsHeight, SWIPE_CARD_WITC_FIELDS_TARGET_H),
    1,
  );

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden",
        className,
      )}
    >
      <div className={SWIPE_CARD_WITC_PHOTO_BAND}>
        <CoverImage
          src={src}
          alt={alt}
          priority={priority}
          onNaturalSize={onNaturalSize}
          className="h-full w-full object-bottom"
        />
      </div>
      {/*
        Reflection = a vertically flipped copy of the same cover image, NOT
        `-webkit-box-reflect` (that non-standard property silently fails on iOS
        Safari inside the card's composited/transformed layer, and never
        rendered on Firefox — the reflection was desktop-only). This box is the
        band rectangle (top:0 → bottom:stripHeight, so its height auto-matches
        the band with no measurement → identical object-cover scale), flipped
        about its bottom edge (the seam) so it mirrors into the strip region;
        the card's overflow-hidden clips the part below the card. It sits before
        the strip in DOM, so the blur + darkening overlays paint on top of it.
      */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 origin-bottom overflow-hidden [transform:scaleY(-1)]"
        style={{ bottom: stripHeight }}
        aria-hidden
      >
        <CoverImage src={src} alt="" className="h-full w-full object-bottom" />
      </div>
      <div
        className={SWIPE_CARD_FIELDS_STRIP}
        style={{ height: stripHeight }}
        aria-hidden
      >
        <div className="absolute inset-0 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-black/20" />
        {/* decision: Pato — a bit darker for name/chip contrast, still transparent */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/22 to-black/64" />
      </div>
    </div>
  );
}

/** TIWC — image cover over the entire card. */
function TiwcPhotoSlide({
  src,
  alt,
  priority,
  className,
  onNaturalSize,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
  onNaturalSize?: (size: ImageNaturalSize) => void;
}) {
  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <CoverImage
        src={src}
        alt={alt}
        priority={priority}
        className="absolute inset-0 h-full w-full"
        onNaturalSize={onNaturalSize}
      />
    </div>
  );
}

function CoverImage({
  src,
  alt,
  priority,
  className,
  onNaturalSize,
  style,
}: {
  src: string;
  alt: string;
  priority?: boolean;
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
      fetchPriority={priority ? "high" : "auto"}
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
