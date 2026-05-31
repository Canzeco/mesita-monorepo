"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  type RefObject,
} from "react";
import {
  resolveSwipeCardLayout,
  type SwipeCardLayoutMode,
} from "./swipe-card-layout";

export type ImageNaturalSize = { width: number; height: number };

export const SWIPE_CARD_FALLBACK_FIELDS_H = 148;

const imageSizeCache = new Map<string, ImageNaturalSize>();

const MIN_PHOTO_DIMENSION = 8;
const MAX_IMAGE_RATIO = 20;

/** Stable cache key — strip query/hash so preload and onLoad share one entry. */
export function normalizePhotoSrc(src: string): string {
  try {
    const url = new URL(src);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return src.split("?")[0]?.split("#")[0] ?? src;
  }
}

function isPlausiblePhotoSize(size: ImageNaturalSize): boolean {
  const { width, height } = size;
  if (width < MIN_PHOTO_DIMENSION || height < MIN_PHOTO_DIMENSION) return false;
  const ratio = width / height;
  if (ratio > MAX_IMAGE_RATIO || ratio < 1 / MAX_IMAGE_RATIO) return false;
  return true;
}

/** Read file pixel size from a loaded <img> — never the rendered layout box. */
export function readPhotoNaturalSize(
  img: HTMLImageElement,
): ImageNaturalSize | null {
  const { naturalWidth: width, naturalHeight: height } = img;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
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

export function loadImageNaturalSize(
  src: string,
): Promise<ImageNaturalSize> {
  const key = normalizePhotoSrc(src);
  const cached = imageSizeCache.get(key);
  if (cached) return Promise.resolve(cached);

  return loadImageNaturalSizeViaBitmap(src).catch(() =>
    loadImageNaturalSizeViaElement(src),
  );
}

/** EXIF-aware sizing when fetch + createImageBitmap succeed. */
async function loadImageNaturalSizeViaBitmap(
  src: string,
): Promise<ImageNaturalSize> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob, {
    imageOrientation: "from-image",
  });
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  const cached = cacheImageNaturalSize(src, size);
  if (!cached) throw new Error(`Implausible natural size: ${src}`);
  return cached;
}

function loadImageNaturalSizeViaElement(src: string): Promise<ImageNaturalSize> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const size = readPhotoNaturalSize(img);
      if (!size) {
        reject(new Error(`Failed to read natural size: ${src}`));
        return;
      }
      const cached = cacheImageNaturalSize(src, size);
      if (!cached) {
        reject(new Error(`Implausible natural size: ${src}`));
        return;
      }
      resolve(cached);
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

type ElementSize = { width: number; height: number };

/** Observes an element's layout box via ResizeObserver — not the viewport. */
export function useObservedSize<T extends HTMLElement>(
  ref: RefObject<T | null>,
): ElementSize | null {
  const [size, setSize] = useState<ElementSize | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setSize((prev) =>
          prev?.width === width && prev?.height === height
            ? prev
            : { width, height },
        );
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
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

/**
 * Live TIWC/WITC resolution.
 * Photo side: natural file dimensions only (preloaded + onLoad naturalWidth/H).
 * Card side: full card box. fieldsRef height is layout-only for WITC strip.
 */
export function useSwipeCardPhotoLayout(
  photos: string[],
  cardRef: RefObject<HTMLElement | null>,
  fieldsRef: RefObject<HTMLElement | null>,
) {
  const cardSize = useObservedSize(cardRef);
  const fieldsSize = useObservedSize(fieldsRef);
  const fieldsHeight = fieldsSize?.height ?? SWIPE_CARD_FALLBACK_FIELDS_H;
  const [sizesEpoch, setSizesEpoch] = useState(0);

  // Preload all photo dimensions before paint so slides never start as "unknown".
  useLayoutEffect(() => {
    if (photos.length === 0) return;
    let cancelled = false;
    Promise.all(photos.map((src) => loadImageNaturalSize(src).catch(() => null)))
      .then(() => {
        if (!cancelled) setSizesEpoch((n) => n + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [photos]);

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

  const reportPhotoSize = useCallback((src: string, size: ImageNaturalSize) => {
    const prev = getCachedImageNaturalSize(src);
    const cached = cacheImageNaturalSize(src, size);
    if (!cached) return;
    if (
      !prev ||
      prev.width !== cached.width ||
      prev.height !== cached.height
    ) {
      setSizesEpoch((n) => n + 1);
    }
  }, []);

  /** Defaults to TIWC (full bleed) until photo + card sizes are known. */
  const getPhotoLayoutMode = useCallback(
    (src: string | undefined): SwipeCardLayoutMode => {
      if (!src) return "tiwc";
      return photoModeBySrc.get(src) ?? "tiwc";
    },
    [photoModeBySrc],
  );

  const getPhotoLayoutResult = useCallback(
    (src: string | undefined) => {
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

  const allPhotoModesReady =
    photos.length > 0 && photos.every((src) => photoModeBySrc.has(src));

  return {
    cardSize,
    fieldsHeight,
    getPhotoLayoutMode,
    getPhotoLayoutResult,
    reportPhotoSize,
    allPhotoModesReady,
  };
}

export type { SwipeCardLayoutMode };
export type { SwipeCardLayoutResult } from "./swipe-card-layout";
