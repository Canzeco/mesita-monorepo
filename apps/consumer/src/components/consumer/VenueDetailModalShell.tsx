"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Share2, Bookmark } from "lucide-react";
import { VenueDetailActionBar } from "./VenueDetailBody";
import { ReservationSheet } from "./ReservationSheet";
import { useSavedVenues } from "@/lib/saved-venues";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// Modal chrome for the intercepted /venues/[id] route. Sits as an absolute
// layer inside the shell's content area (between StatusBar and BottomNav,
// matching TicketSheet's positioning). The wrapped VenueDetailBody scrolls
// in a dedicated middle band; dismiss is router.back(), so the URL
// restores to whichever surface the user came from with its state intact.
//
// Layout is three rigid rows in a flex-col so the action bar can never
// occlude the body's last visible content:
//   1. Header (shrink-0) — translucent dismiss + venue name + bookmark + share
//   2. Scroll area (flex-1 overflow-y-auto) — VenueDetailBody renders
//      every section inside this band
//   3. Action bar (shrink-0) — the primary CTA cluster, always visible

export function VenueDetailModalShell({
  children,
  venueId,
  venueName,
}: {
  children: React.ReactNode;
  venueId: string;
  venueName: string;
}) {
  const router = useRouter();
  const { isSaved, toggle } = useSavedVenues();
  const saved = isSaved(venueId);
  const [reserveOpen, setReserveOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Reservation sheet owns its own Escape handler, so only dismiss
      // the venue modal when the sheet isn't open.
      if (e.key === "Escape" && !reserveOpen) router.back();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, reserveOpen]);

  function onShare() {
    const shareData = {
      title: venueName,
      text: `Check out ${venueName} on Mesita`,
      url: typeof window !== "undefined" ? window.location.href : "",
    };
    // Web Share API is the native iOS/Android share sheet. Falls back to
    // clipboard for desktop / older browsers — the toast tells the user
    // what happened either way so silent failures don't ghost the action.
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      navigator.share(shareData).catch(() => {
        /* user cancelled — no toast, that's expected */
      });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(shareData.url)
        .then(() => toast.success("Link copied to clipboard"))
        .catch(() => toast.error("Couldn't copy link"));
      return;
    }
    toast.error("Sharing isn't available in this browser");
  }

  function onBookmark() {
    const nowSaved = !saved;
    toggle(venueId);
    if (nowSaved) {
      toast.action(
        `Saved ${venueName}`,
        { label: "View", onClick: () => router.push("/saved") },
        { tone: "success" },
      );
    } else {
      toast(`Removed ${venueName} from saved`);
    }
  }

  return (
    // overflow-hidden on the outer container so the slide-in animation
    // doesn't expose a horizontal scrollbar during the translate. The
    // left-edge shadow sells the "covering sheet" depth so the underlying
    // shell reads as paused, not removed.
    <div className="animate-in slide-in-from-right bg-background absolute inset-0 z-50 flex flex-col overflow-hidden shadow-[-12px_0_32px_rgba(0,0,0,0.4)] duration-300 ease-out">
      <header className="bg-background/85 z-20 flex shrink-0 items-center gap-2 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-foreground border-border border transition hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="font-display flex-1 truncate text-center text-sm font-semibold">
          {venueName}
        </p>
        <button
          type="button"
          onClick={onBookmark}
          aria-label={saved ? "Unsave" : "Save"}
          aria-pressed={saved}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
            saved
              ? "bg-pink-gradient text-white shadow-sm"
              : "bg-card text-foreground border-border border hover:bg-muted",
          )}
        >
          <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
        </button>
        <button
          type="button"
          onClick={onShare}
          aria-label="Share"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-foreground border-border border transition hover:bg-muted"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </header>
      {/*
        `min-h-0` is the load-bearing class here: without it, a flex-1 child
        keeps its default `min-height: auto` (= content size) and grows to
        fit the whole VenueDetailBody — `overflow-y-auto` then never
        triggers, the page scrolls on the outer body instead, and
        `position: sticky top-0` on the section nav ends up anchored to a
        scroll container that isn't actually scrolling. The visible
        symptom was the RewardsBox pink hero appearing in the gap between
        the modal header and the (mis-pinned) section nav.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <VenueDetailActionBar
        venueId={venueId}
        venueName={venueName}
        onReserve={() => setReserveOpen(true)}
      />
      <ReservationSheet
        venueId={venueId}
        venueName={venueName}
        open={reserveOpen}
        onClose={() => setReserveOpen(false)}
      />
    </div>
  );
}
