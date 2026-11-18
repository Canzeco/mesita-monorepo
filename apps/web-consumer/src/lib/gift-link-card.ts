// A GIFT LINK'S CARD (Pato, 2026-11-18, MESITA-4363: "the image must be the
// actual gift card and place"): what the Sign and cover pages, where a
// signed-out gift link lands, put in their link tags. Pure, so the two pages
// and the image say the same words.

import type { Metadata } from "next";

/** How long the Sign and cover pages wait for a gift link's preview
 *  (MESITA-4391). A chat app keeps a link's FIRST preview: at 1.5 s a cold
 *  read (1.3 s on Supabase plus the Vercel ↔ Oregon hop) lost the gift card
 *  to the plain Mesita card for good. A typical read is ~0.7 s; only a gift
 *  link waits. */
export const GIFT_PREVIEW_PAGE_TIMEOUT_MS = 5000;

/** Where the gift's card is drawn: a .jpg path, past the proxy's matcher.
 *  ?v= is the design's version: chat apps keep an image by its address.
 *  A claimed gift's card has its own address (MESITA-4367), so no cache
 *  that kept the open card answers it. */
export function giftCardImagePath(token: string, claimed = false): string {
  return `/og/gift/${encodeURIComponent(token)}.jpg?v=1${claimed ? "&claimed=1" : ""}`;
}

/** "From Patricio on Mesita. Sign in to take it." A claimed gift (MESITA-4367):
 *  "From Patricio on Mesita. Someone already took it." */
export function giftDescription(senderName: string | null, claimed = false): string {
  return `From ${senderName ?? "a friend"} on Mesita. ${claimed ? "Someone already took it." : "Sign in to take it."}`;
}

/** The sign-in page's line under the headline. */
export function giftSignTitle(gift: { line: string; claimed: boolean }): string {
  return gift.claimed ? `${gift.line}. Someone already took it.` : `${gift.line}. Sign in to take it.`;
}

/** "$100.00MX of credit at Orinoco", or "Claimed: $100.00MX of credit at
 *  Orinoco" once someone took it (MESITA-4367). */
export function giftLine(amount: string, placeName: string | null, claimed: boolean): string {
  const line = placeName ? `${amount} of credit at ${placeName}` : `${amount} of credit`;
  return claimed ? `Claimed: ${line}` : line;
}

/** The gift's title, description and card for a page's metadata. */
export function giftMetadata(
  gift: { line: string; token: string; senderName: string | null; claimed: boolean },
  parent: { openGraph: Metadata["openGraph"] | null; twitter: Metadata["twitter"] | null },
): Metadata {
  const description = giftDescription(gift.senderName, gift.claimed);
  const image = {
    url: giftCardImagePath(gift.token, gift.claimed),
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
