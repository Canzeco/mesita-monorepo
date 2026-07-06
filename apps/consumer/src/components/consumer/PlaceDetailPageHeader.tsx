"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Share2, Heart } from "lucide-react";
import { useSavedPlaces } from "@/lib/saved-places";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Header for the hard-nav /place/[id] page (refresh / direct URL / new
// tab). Mirrors the modal shell's header but with an ArrowLeft Link back
// to /discover/swipe instead of a router.back() X close — the modal can
// route home because there's always a previous shell route; the hard-nav
// page can't trust browser history.

export function PlaceDetailPageHeader({
  placeId,
  placeName,
  backHref = CONSUMER_ROUTES.home,
}: {
  placeId: string;
  placeName: string;
  backHref?: string;
}) {
  const router = useRouter();
  const { isSaved, toggle } = useSavedPlaces();
  const saved = isSaved(placeId);

  function onShare() {
    const shareData = {
      title: placeName,
      text: `Check out ${placeName} on Mesita`,
      url: typeof window !== "undefined" ? window.location.href : "",
    };
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      navigator.share(shareData).catch(() => {
        /* user cancelled */
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
    toggle(placeId);
    if (nowSaved) {
      toast.action(
        `Saved ${placeName}`,
        {
          label: "View",
          onClick: () => router.push(CONSUMER_ROUTES.favorites),
        },
        { tone: "success" },
      );
    } else {
      toast(`Removed ${placeName} from saved`);
    }
  }

  return (
    <header className="bg-background/85 z-20 flex shrink-0 items-center gap-2 px-3 py-3 backdrop-blur">
      <Link
        href={backHref}
        aria-label="Back"
        className="bg-card text-foreground border-border hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <p className="font-display flex-1 truncate text-center text-sm font-semibold">
        {placeName}
      </p>
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
        <Heart className={cn("h-4 w-4", saved && "fill-current")} />
      </button>
      <button
        type="button"
        onClick={onShare}
        aria-label="Share"
        className="bg-card text-foreground border-border hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition"
      >
        <Share2 className="h-4 w-4" />
      </button>
    </header>
  );
}
