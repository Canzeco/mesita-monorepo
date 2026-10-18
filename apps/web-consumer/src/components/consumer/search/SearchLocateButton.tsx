"use client";

import { LocateFixed } from "lucide-react";

import { cn } from "@/lib/utils";

// The map's location control, TOP LEFT (Pato, 2026-10-17: "Location
// Searchbar Filters … location at the left"). A 44px disc wearing the
// locate icon and nothing else — the bar's chrome, like the Filters disc
// on the other side.
//
// One tap, two meanings: with no fix yet it asks the browser for one (the
// permission prompt is the browser's); with a fix it recentres the camera
// on the guest. The accessible name says which.
export function SearchLocateButton({
  located,
  locating,
  onClick,
}: {
  located: boolean;
  locating: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locating}
      aria-busy={locating || undefined}
      aria-label={
        locating
          ? "Locating"
          : located
            ? "Recentre on your location"
            : "Use my location"
      }
      className={cn(
        "shadow-elev flex h-11 w-11 shrink-0 items-center justify-center rounded-full border backdrop-blur-xl transition active:scale-[0.97] disabled:opacity-60",
        "border-border bg-card/95",
        located ? "text-primary" : "text-foreground",
      )}
    >
      <LocateFixed
        className={cn("h-5 w-5 shrink-0", locating && "animate-pulse")}
        strokeWidth={2.25}
        aria-hidden
      />
    </button>
  );
}
