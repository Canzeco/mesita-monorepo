import { useCallback, useMemo, useState } from 'react';

import {
  resolveSwipeCardLayout,
  type SwipeCardLayoutMode,
  type SwipeCardLayoutResult,
} from '@/lib/swipe-card-layout';

export type ImageNaturalSize = { width: number; height: number };

/** Hidden-measure fallback so WITC strip never collapses before chips layout. */
export const SWIPE_CARD_FALLBACK_FIELDS_H = 200;

const imageSizeCache = new Map<string, ImageNaturalSize>();

const MIN_PHOTO_DIMENSION = 8;
const MAX_IMAGE_RATIO = 20;

export function normalizePhotoSrc(src: string): string {
  try {
    const url = new URL(src);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return src.split('?')[0]?.split('#')[0] ?? src;
  }
}

function isPlausiblePhotoSize(size: ImageNaturalSize): boolean {
  const { width, height } = size;
  if (width < MIN_PHOTO_DIMENSION || height < MIN_PHOTO_DIMENSION) return false;
  const ratio = width / height;
  if (ratio > MAX_IMAGE_RATIO || ratio < 1 / MAX_IMAGE_RATIO) return false;
  return true;
}

export function cacheImageNaturalSize(
  src: string,
  size: ImageNaturalSize,
): ImageNaturalSize | null {
  if (!isPlausiblePhotoSize(size)) return null;
  const key = normalizePhotoSrc(src);
  imageSizeCache.set(key, size);
  return size;
}

export function getCachedImageNaturalSize(
  src: string,
): ImageNaturalSize | undefined {
  return imageSizeCache.get(normalizePhotoSrc(src));
}

export function resolvePhotoLayoutMode(
  imageSize: ImageNaturalSize | null | undefined,
  cardWidth: number,
  cardHeight: number,
): SwipeCardLayoutMode | null {
  if (!imageSize) return null;
  return resolveSwipeCardLayout({
    photoNaturalWidth: imageSize.width,
    photoNaturalHeight: imageSize.height,
    cardWidth,
    cardHeight,
  }).mode;
}

type ElementSize = { width: number; height: number };

/**
 * Live TIWC/WITC resolution for RN.
 * Photo: natural file pixels from Image.onLoad.
 * Card: onLayout box. fieldsHeight from measured chip stack (or fallback).
 */
export function useSwipeCardPhotoLayout(photos: string[]) {
  const [cardSize, setCardSize] = useState<ElementSize | null>(null);
  const [fieldsHeightRaw, setFieldsHeightRaw] = useState(0);
  const [sizesEpoch, setSizesEpoch] = useState(0);

  const fieldsHeight = Math.max(
    Math.ceil(fieldsHeightRaw || SWIPE_CARD_FALLBACK_FIELDS_H),
    SWIPE_CARD_FALLBACK_FIELDS_H,
  );

  const onCardLayout = useCallback(
    (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      setCardSize((prev) =>
        prev?.width === width && prev?.height === height
          ? prev
          : { width, height },
      );
    },
    [],
  );

  const onFieldsLayout = useCallback((height: number) => {
    if (height <= 0) return;
    setFieldsHeightRaw((prev) => (prev === height ? prev : height));
  }, []);

  const reportPhotoSize = useCallback((src: string, size: ImageNaturalSize) => {
    const prev = getCachedImageNaturalSize(src);
    const cached = cacheImageNaturalSize(src, size);
    if (!cached) return;
    if (!prev || prev.width !== cached.width || prev.height !== cached.height) {
      setSizesEpoch((n) => n + 1);
    }
  }, []);

  const photoModeBySrc = useMemo(() => {
    void sizesEpoch;
    if (!cardSize) return new Map<string, SwipeCardLayoutMode>();
    const modes = new Map<string, SwipeCardLayoutMode>();
    for (const src of photos) {
      const mode = resolvePhotoLayoutMode(
        getCachedImageNaturalSize(src),
        cardSize.width,
        cardSize.height,
      );
      if (mode) modes.set(src, mode);
    }
    return modes;
  }, [photos, cardSize, sizesEpoch]);

  const getPhotoLayoutMode = useCallback(
    (src: string | undefined): SwipeCardLayoutMode => {
      if (!src) return 'tiwc';
      return photoModeBySrc.get(src) ?? 'tiwc';
    },
    [photoModeBySrc],
  );

  const getPhotoLayoutResult = useCallback(
    (src: string | undefined): SwipeCardLayoutResult | null => {
      void sizesEpoch;
      if (!src || !cardSize) return null;
      const imageSize = getCachedImageNaturalSize(src);
      if (!imageSize) return null;
      return resolveSwipeCardLayout({
        photoNaturalWidth: imageSize.width,
        photoNaturalHeight: imageSize.height,
        cardWidth: cardSize.width,
        cardHeight: cardSize.height,
      });
    },
    [cardSize, sizesEpoch],
  );

  return {
    cardSize,
    fieldsHeight,
    onCardLayout,
    onFieldsLayout,
    getPhotoLayoutMode,
    getPhotoLayoutResult,
    reportPhotoSize,
  };
}

export type { SwipeCardLayoutMode };
export type { SwipeCardLayoutResult } from '@/lib/swipe-card-layout';
