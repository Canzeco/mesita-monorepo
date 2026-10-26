"use client";

// Opening a place from a tap, so the tap can never be swallowed
// (MESITA-2816). On Search, a card tap reached neither consumer-web-get-place
// nor consumer-web-create-place and the address stayed /web/search, while
// the same push from Home opened the place.
//
// Two guards. The push goes to the URL the guest's surface serves
// (/web/place/…), as the bottom bar's taps do since MESITA-2772, not the bare
// /place/… the proxy would have to redirect. And when the screen has not
// moved after NAV_FALLBACK_MS, the place loads as a page at that URL: a
// client navigation stuck behind another never leaves the guest on a dead
// card.

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { prefixPath, surfaceOf } from "@/lib/surface";

/** Long enough for a slow push to commit its loading frame, short enough
 *  that a dead tap still reads as a slow one. */
export const NAV_FALLBACK_MS = 2500;

export function useOpenPlaceHref(): (href: string) => void {
  const router = useRouter();
  return useCallback(
    (href: string) => {
      const from = window.location.pathname;
      const target = prefixPath(surfaceOf(from) ?? "web", href);
      router.push(target);
      window.setTimeout(() => {
        if (window.location.pathname === from) window.location.assign(target);
      }, NAV_FALLBACK_MS);
    },
    [router],
  );
}
