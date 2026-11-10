"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { goBack } from "@/lib/navigate";
import { useKeptScroll } from "@/lib/use-kept-scroll";
import { cn } from "@/lib/utils";

// THE FRAME EVERY PUSHED PAGE WEARS (MESITA-3647): back, a centred title, an
// optional action, and the one scroller under them. Every Me page, Settings'
// subpages, Share, the bill, its receipt, a House Card and a reservation
// opened from a link wear it, so a screen that slides in over another always
// has the same way out in the same place.
//
// ONE BACK MARK: the chevron the place screen's top bar uses. Me pages and
// the bill wore an arrow until this.
//
// FULL PAGE, NOT A SHEET (Pato, 2026-09-12) and THE BOTTOM NAV STAYS: the
// screen owns the body, the shell owns the bar (the route map says where it
// shows).
//
// BACK IS A HISTORY POP (lib/navigate.ts goBack): the screen slides away and
// uncovers the one under it, scrolled where you left it; a screen opened
// from outside the app lands on its parent in the route map instead.

export function Screen({
  title,
  children,
  flush = false,
  action,
  onBack,
}: {
  title: string;
  children: React.ReactNode;
  /** Skip body padding: a feed that lays out its own column. */
  flush?: boolean;
  /** The header's right slot (Profile's Save, MESITA-3101). The side
   *  columns stay equal, so the title stays centred. */
  action?: React.ReactNode;
  /** Replace Back (a screen that must close something first). */
  onBack?: () => void;
}) {
  const router = useRouter();
  const back = useCallback(() => goBack(router), [router]);
  const keep = useKeptScroll<HTMLDivElement>();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="border-border bg-background/90 sticky top-0 z-20 grid shrink-0 grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2 border-b px-3 py-2 backdrop-blur-xl">
        <button
          type="button"
          onClick={onBack ?? back}
          aria-label="Back"
          className="bg-card text-foreground border-border hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition active:scale-[0.98]"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </button>
        <h1 className="font-display min-w-0 truncate text-center text-xl font-semibold tracking-tight">
          {title}
        </h1>
        <div className="flex min-h-11 justify-end">{action}</div>
      </header>

      <div
        ref={keep}
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
