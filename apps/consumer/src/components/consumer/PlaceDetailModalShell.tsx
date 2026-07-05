"use client";

import { Share2, Bookmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { PlaceDetailActionBar } from "./PlaceDetailBody";
import { SlideOverHeader } from "@/components/consumer/overlay/SlideOverShell";
import { useSavedPlaces } from "@/lib/saved-places";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Content chrome for the intercepted /place/[id] route. The sliding panel
// itself (enter/exit animation, backdrop, ESC, router.back on dismiss) is
// SlideOverShell, mounted by the segment's layout.tsx — this component only
// fills it with the place header, scrollable body, and action bar.
//
// Layout is three rigid rows in a flex-col so the action bar can never
// occlude the body's last visible content:
//   1. SlideOverHeader (shrink-0) — dismiss + place name + bookmark + share
//   2. Scroll area (flex-1 overflow-y-auto) — PlaceDetailBody renders
//      every section inside this band
//   3. Action bar (shrink-0) — the primary CTA cluster, always visible

export function PlaceDetailModalShell({
  children,
  projectId,
  placeName,
}: {
  children: React.ReactNode;
  projectId: string;
  placeName: string;
}) {
  const router = useRouter();
  const { isSaved, toggle } = useSavedPlaces();
  const saved = isSaved(projectId);

  function onShare() {
    const shareData = {
      title: placeName,
      text: `Check out ${placeName} on Mesita`,
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
    toggle(projectId);
    if (nowSaved) {
      toast.action(
        `Saved ${placeName}`,
        {
          label: "View",
          onClick: () => router.push(CONSUMER_ROUTES.saved.places),
        },
        { tone: "success" },
      );
    } else {
      toast(`Removed ${placeName} from saved`);
    }
  }

  return (
    <>
      <SlideOverHeader
        title={placeName}
        actions={
          <>
            <button
              type="button"
              onClick={onBookmark}
              aria-label={saved ? "Unsave" : "Save"}
              aria-pressed={saved}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition",
                saved
                  ? "bg-pink-gradient text-white shadow-sm"
                  : "bg-card text-foreground border-border hover:bg-muted border",
              )}
            >
              <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
            </button>
            <button
              type="button"
              onClick={onShare}
              aria-label="Share"
              className="bg-card text-foreground border-border hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </>
        }
      />
      {/*
        `min-h-0` is the load-bearing class here: without it, a flex-1 child
        keeps its default `min-height: auto` (= content size) and grows to
        fit the whole PlaceDetailBody — `overflow-y-auto` then never
        triggers, the page scrolls on the outer body instead, and
        `position: sticky top-0` on the section nav ends up anchored to a
        scroll container that isn't actually scrolling. The visible
        symptom was the RewardsBox pink hero appearing in the gap between
        the modal header and the (mis-pinned) section nav.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <PlaceDetailActionBar placeId={projectId} placeName={placeName} />
    </>
  );
}
