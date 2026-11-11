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
// FULL PAGE, NOT A SHEET (Pato, 2026-09-12): the screen owns the body, the
// shell owns the bar, and the route map says where the bar shows. It stays
// on every pushed page except the four pay screens (payPlace, payTab,
// payJoin, payReceipt; MESITA-3739), which own the whole frame like the
// place screen does.
//
// PAPER (MESITA-3739, Pato: "white background. that looks like shit"): the
// pay screens sit on white, header included, not on the grey ground. Off a
// production build a paper screen also flags its own overflow
// (`data-overflow` and one console warning), because those screens are
// built to never scroll and the app has no visual QA path.
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
  paper = false,
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
  /** White ground and header instead of the grey (the pay screens). */
  paper?: boolean;
}) {
  const router = useRouter();
  const back = useCallback(() => goBack(router), [router]);
  const keep = useKeptScroll<HTMLDivElement>();
  // A paper screen watches its own fit through the same callback ref.
  const setBody = useCallback(
    (el: HTMLDivElement | null) => {
      keep(el);
      if (!el || !paper) return;
      return watchOverflow(el);
    },
    [keep, paper],
  );

  return (
    <div className={cn("flex h-full min-h-0 flex-1 flex-col", paper && "bg-card")}>
      <header className={cn("border-border sticky top-0 z-20 grid shrink-0 grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2 border-b px-3 py-2 backdrop-blur-xl", paper ? "bg-card/90" : "bg-background/90")}>
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
        ref={setBody}
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

const SHOW_OVERFLOW = process.env.NEXT_PUBLIC_VERCEL_ENV !== "production";

/** Off production: mark a screen that was built never to scroll when it
 *  does, so a check on a phone or in the browser pane sees it at once.
 *  Returns the ref's cleanup. */
function watchOverflow(el: HTMLDivElement): (() => void) | undefined {
  if (!SHOW_OVERFLOW || typeof ResizeObserver === "undefined") return undefined;
  let warned = false;
  const check = () => {
    const over = el.scrollHeight > el.clientHeight + 1;
    if (over) el.setAttribute("data-overflow", "true");
    else el.removeAttribute("data-overflow");
    if (over && !warned) {
      warned = true;
      console.warn(`[pay fit] ${location.pathname} scrolls: ${el.scrollHeight}px in ${el.clientHeight}px`);
    }
  };
  const ro = new ResizeObserver(check);
  ro.observe(el);
  if (el.firstElementChild) ro.observe(el.firstElementChild);
  check();
  return () => ro.disconnect();
}
