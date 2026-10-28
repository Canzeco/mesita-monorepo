"use client";

import { useState, type ImgHTMLAttributes } from "react";
import Image, { type ImageProps } from "next/image";
import { photoUrl, type PhotoSize } from "../photo-url";

// A stored photo drawn at its saved size (MESITA-2966). The size is already
// small WebP, so next/image does not resize it again (unoptimized). A size
// that is missing (an upload seconds old, a failed render) falls back to the
// original once.

function useSized(src: string, size: PhotoSize) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const sized = photoUrl(src, size);
  const useSize = sized !== src && failedSrc !== src;
  return {
    url: useSize ? sized : src,
    sized: useSize,
    fail: () => {
      if (useSize) setFailedSrc(src);
    },
  };
}

export function SizedImage({
  src,
  size,
  unoptimized,
  onError,
  alt,
  ...rest
}: Omit<ImageProps, "src"> & { src: string; size: PhotoSize }) {
  const photo = useSized(src, size);
  return (
    <Image
      {...rest}
      alt={alt}
      src={photo.url}
      unoptimized={photo.sized || unoptimized}
      onError={(e) => {
        photo.fail();
        onError?.(e);
      }}
    />
  );
}

export function SizedImg({
  src,
  size,
  onError,
  alt,
  ...rest
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  size: PhotoSize;
}) {
  const photo = useSized(src, size);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      alt={alt}
      src={photo.url}
      onError={(e) => {
        photo.fail();
        onError?.(e);
      }}
    />
  );
}
