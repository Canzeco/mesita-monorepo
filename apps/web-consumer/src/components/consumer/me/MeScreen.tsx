"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { cn } from "@/lib/utils";

// The frame every Me box wears: back, title, body.
//
// FULL PAGE, NOT A SHEET (Pato, 2026-09-12). Every DestTile on /me opened a
// LocalSheet over the hub. That read as a card stacked on a blur, and the
// stacked history was a second sheet, not a route.
//
// THE BOTTOM NAV STAYS. (shell)/layout.tsx shows it on every shell route.
// A full-page view here owns the BODY, not the frame.
//
// BACK IS A HISTORY POP with a fallback (decided for the place page's back
// arrow, MESITA-1070): a guest who arrived from /me returns to their scroll position;
// a cold load of /me/profile lands on /me rather than off the end of the app.

export function MeScreen({
  title,
  children,
  flush = false,
}: {
  title: string;
  children: React.ReactNode;
  /** Skip body padding — Activity feeds need a flex column that can scroll. */
  flush?: boolean;
}) {
  const router = useRouter();

  const onBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(CONSUMER_ROUTES.me);
  }, [router]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="border-border bg-background/90 sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b px-3 py-2 backdrop-blur-xl">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="bg-card text-foreground border-border hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-display min-w-0 flex-1 truncate text-center text-xl font-semibold tracking-tight">
          {title}
        </h1>
        <div className="h-11 w-11 shrink-0" aria-hidden />
      </header>

      <div
        className={cn(
          "scrollbar-hide min-h-0 flex-1 overflow-y-auto",
          flush ? "flex flex-col" : "px-5 py-5",
        )}
      >
        {children}
      </div>
    </div>
  );
}
