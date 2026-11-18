// A GIFT LINK'S CARD (Pato, 2026-11-18, MESITA-4363: "the image must be the
// actual gift card and place"): what the Sign and cover pages, where a
// signed-out gift link lands, put in their link tags. Pure, so the two pages
// and the image say the same words.

import type { Metadata } from "next";

/** Where the gift's card is drawn: a .jpg path, past the proxy's matcher.
 *  ?v= is the design's version: chat apps keep an image by its address. */
export function giftCardImagePath(token: string): string {
  return `/og/gift/${encodeURIComponent(token)}.jpg?v=1`;
}

/** "From Patricio on Mesita. Sign in to take it." */
export function giftDescription(senderName: string | null): string {
  return `From ${senderName ?? "a friend"} on Mesita. Sign in to take it.`;
}

/** The gift's title, description and card for a page's metadata. */
export function giftMetadata(
  gift: { line: string; token: string; senderName: string | null },
  parent: { openGraph: Metadata["openGraph"] | null; twitter: Metadata["twitter"] | null },
): Metadata {
  const description = giftDescription(gift.senderName);
  const image = {
    url: giftCardImagePath(gift.token),
    width: 1200,
    height: 630,
    alt: `${gift.line}. ${description}`,
  };
  return {
    title: gift.line,
    description,
    openGraph: { ...parent.openGraph, title: gift.line, description, images: [image] } as Metadata["openGraph"],
    twitter: {
      ...parent.twitter,
      card: "summary_large_image",
      title: gift.line,
      description,
      images: [image.url],
    } as Metadata["twitter"],
  };
}
