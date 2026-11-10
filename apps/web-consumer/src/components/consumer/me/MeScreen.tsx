"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { goBack } from "@/lib/navigate";
import { ArrowLeft } from "lucide-react";
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
  action,
}: {
  title: string;
  children: React.ReactNode;
  /** Skip body padding — Activity feeds need a flex column that can scroll. */
  flush?: boolean;
  /** The header's right slot, empty by default: Profile's Save (MESITA-3101),
   *  so the form fits on one screen without a button row under it. The two
   *  side columns stay equal, so the title stays centred. */
  action?: React.ReactNode;
}) {
  const router = useRouter();

  const onBack = useCallback(() => goBack(router), [router]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="border-border bg-background/90 sticky top-0 z-20 grid shrink-0 grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2 border-b px-3 py-2 backdrop-blur-xl">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="bg-card text-foreground border-border hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-display min-w-0 truncate text-center text-xl font-semibold tracking-tight">
          {title}
        </h1>
        <div className="flex min-h-11 justify-end">{action}</div>
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
