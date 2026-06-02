"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Share2 } from "lucide-react";
import { toast } from "@/lib/toast";

// Modal chrome for the intercepted /reservation/[id] route. Mirrors
// VenueDetailModalShell — absolute layer inside the shell's content
// area, three rigid rows (header / scroll body / no action bar). We
// don't carry an action bar here because the body's own buttons (View
// venue / Add to calendar / Call / Cancel) cover the reservation-level
// actions.

export function ReservationDetailModalShell({
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

  function onShare() {
    const shareData = {
      title: `${venueName} on Mesita`,
      text: `My reservation at ${venueName}`,
      url: typeof window !== "undefined" ? window.location.href : "",
    };
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      navigator.share(shareData).catch(() => {
        /* user cancelled — no toast */
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

  return (
    <div className="animate-in slide-in-from-right bg-background pointer-events-auto absolute inset-0 z-50 flex flex-col overflow-hidden shadow-[-12px_0_32px_rgba(0,0,0,0.4)] duration-300 ease-out">
      <header className="bg-background/85 z-20 flex shrink-0 items-center gap-2 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="border-border bg-card text-foreground hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
        </button>
        <p className="font-display flex-1 truncate text-center text-sm font-semibold">
          Reservation
        </p>
        <button
          type="button"
          onClick={onShare}
          aria-label="Share"
          className="border-border bg-card text-foreground hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </header>
      {/*
        `min-h-0` is load-bearing — without it the flex-1 child grows to
        fit content, `overflow-y-auto` never triggers, and the body
        scrolls on the outer shell instead. Same trap as
        VenueDetailModalShell.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
