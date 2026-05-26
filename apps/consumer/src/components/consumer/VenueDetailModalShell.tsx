"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Share2 } from "lucide-react";

// Modal chrome for the intercepted /venues/[id] route. Sits as an absolute
// layer inside the shell's content area (between StatusBar and BottomNav,
// matching TicketSheet's positioning). The wrapped VenueDetailBody scrolls
// inside; dismiss is router.back(), so the URL restores to whichever
// surface the user came from (discover/catalog, discover/swipe, etc.) with
// its state intact.
//
// Header bar mirrors the hard-nav page: a sticky translucent row with a
// left dismiss button and a right Share button.

export function VenueDetailModalShell({
  children,
}: {
  children: React.ReactNode;
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
    <div className="bg-background absolute inset-0 z-50 flex flex-col overflow-y-auto">
      <header className="bg-background/85 sticky top-0 z-20 flex items-center justify-between gap-3 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-zinc-900 transition hover:bg-white"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Share"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-zinc-900 transition hover:bg-white"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </header>
      {children}
    </div>
  );
}
