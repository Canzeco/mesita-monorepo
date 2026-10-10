"use client";

import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/shared";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { barePath } from "@/lib/surface";

// What Home's four pills show while the shared deck loads.
//
// SCROLL GETS AN INK BLOCK, EVERY OTHER PILL KEEPS ITS SKELETON (MESITA-2105).
// Scroll is a full-bleed photo feed, so a rounded grey card floating in the
// page announces a different screen from the one about to paint; a flat ink
// field is the same shape as the photo that replaces it. Home, Chat and Favs
// are card layouts on the page ground, and their rounded skeleton is right —
// `discover-loading-fallback.test.tsx` pins both halves.
export function DiscoverFallback() {
  // Bare, because the browser keeps /web or /mob in front (MESITA-2066).
  const pathname = barePath(usePathname() ?? "/");
  if (pathname === CONSUMER_ROUTES.discoverTabs.scroll) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading places"
        className="bg-foreground min-h-0 flex-1"
      />
    );
  }
  return (
    <div className="min-h-0 flex-1 p-4">
      <Skeleton className="h-full w-full rounded-2xl" />
    </div>
  );
}
