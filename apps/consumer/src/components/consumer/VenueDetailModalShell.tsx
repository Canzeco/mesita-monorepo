"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Share2 } from "lucide-react";
import { VenueDetailActionBar } from "./VenueDetailBody";

// Modal chrome for the intercepted /venues/[id] route. Sits as an absolute
// layer inside the shell's content area (between StatusBar and BottomNav,
// matching TicketSheet's positioning). The wrapped VenueDetailBody scrolls
// in a dedicated middle band; dismiss is router.back(), so the URL
// restores to whichever surface the user came from (discover/catalog,
// discover/swipe, etc.) with its state intact.
//
// Layout is three rigid rows in a flex-col so the action bar can never
// occlude the body's last visible content:
//   1. Header (shrink-0) — translucent dismiss + venue name + share
//   2. Scroll area (flex-1 overflow-y-auto) — VenueDetailBody renders
//      every section inside this band
//   3. Action bar (shrink-0) — the primary CTA cluster, always visible

export function VenueDetailModalShell({
  children,
  venueName,
}: {
  children: React.ReactNode;
  venueName: string;
}) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") router.back();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    // overflow-hidden on the outer container so the slide-in animation
    // doesn't expose a horizontal scrollbar during the translate. The
    // left-edge shadow sells the "covering sheet" depth so the underlying
    // shell reads as paused, not removed.
    <div className="animate-in slide-in-from-right bg-background absolute inset-0 z-50 flex flex-col overflow-hidden shadow-[-12px_0_32px_rgba(0,0,0,0.4)] duration-300 ease-out">
      <header className="bg-background/85 z-20 flex shrink-0 items-center gap-3 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/95 text-zinc-900 transition hover:bg-white"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="font-display flex-1 truncate text-center text-sm font-semibold">
          {venueName}
        </p>
        <button
          type="button"
          aria-label="Share"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/95 text-zinc-900 transition hover:bg-white"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
      <VenueDetailActionBar />
    </div>
  );
}
