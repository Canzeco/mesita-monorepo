"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Share2, Bookmark } from "lucide-react";
import { useSavedVenues } from "@/lib/saved-venues";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// Header for the hard-nav /venues/[id] page (refresh / direct URL / new
// tab). Mirrors the modal shell's header but with an ArrowLeft Link back
// to /discover/swipe instead of a router.back() X close — the modal can
// route home because there's always a previous shell route; the hard-nav
// page can't trust browser history.

export function VenueDetailPageHeader({
  venueId,
  venueName,
}: {
  venueId: string;
  venueName: string;
}) {
  const router = useRouter();
  const { isSaved, toggle } = useSavedVenues();
  const saved = isSaved(venueId);

  function onShare() {
    const shareData = {
      title: venueName,
      text: `Check out ${venueName} on Mesita`,
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
    <header className="bg-background/85 z-20 flex shrink-0 items-center gap-2 px-3 py-3 backdrop-blur">
      <Link
        href="/discover/swipe"
        aria-label="Back"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/95 text-zinc-900 transition hover:bg-white"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
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
            : "bg-white/95 text-zinc-900 hover:bg-white",
        )}
      >
        <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
      </button>
      <button
        type="button"
        onClick={onShare}
        aria-label="Share"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/95 text-zinc-900 transition hover:bg-white"
      >
        <Share2 className="h-4 w-4" />
      </button>
    </header>
  );
}
