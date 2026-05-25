"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

// Modal chrome for the intercepted /venues/[id] route. Sits as an absolute
// layer inside the shell's content area (between StatusBar and BottomNav,
// matching TicketSheet's positioning). The wrapped VenueDetailBody scrolls
// inside; dismiss is router.back(), so the URL restores to whichever
// surface the user came from (discover/catalog, discover/swipe, etc.) with
// its state intact.
//
// The full /venues/[id] page (hard nav / direct URL) does not use this
// shell — it gets its own back arrow that points to /discover/swipe.

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
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="Close"
        className="absolute top-3 left-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-zinc-900 backdrop-blur transition hover:bg-white"
      >
        <X className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}
