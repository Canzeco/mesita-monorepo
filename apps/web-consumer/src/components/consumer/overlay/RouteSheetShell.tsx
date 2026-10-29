"use client";

import { createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OVERLAY_BACKDROP_CLASS,
  OVERLAY_EASE,
  useOverlayPresence,
} from "@/components/consumer/overlay/overlay-presence";
import { SEMI_MODAL_PANEL_CLASS } from "@/components/consumer/overlay/LocalOverlay";
import { isModalContractPath } from "@/lib/consumer-route-contract";
import { SHEET_GRABBER_CLASS } from "@/lib/ui-classes";

// THE ROUTED SHEET: a route modal that rises from the bottom instead of
// pushing in from the right, so the page under it stays in view (Ask AI over
// Search's map, MESITA-2475). The panel is LocalSheet's own 88% panel — a
// guest cannot tell a route modal from a state modal and should not have to.
//
// Same contracts as SlideOverShell: mount it from the intercepted segment's
// layout.tsx, `absolute` within the shell's modal host (never `fixed`), the
// stale-slot guard on isModalContractPath, and dismiss is router.back() after
// the exit transition.

const RouteSheetCloseContext = createContext<(() => void) | null>(null);

export function RouteSheetShell({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const onModalRoute = isModalContractPath(pathname);
  const { open, requestClose } = useOverlayPresence(() => router.back(), {
    active: onModalRoute,
  });

  if (!onModalRoute) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex flex-col justify-end overflow-hidden">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={requestClose}
        className={cn(
          OVERLAY_BACKDROP_CLASS,
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn(
          SEMI_MODAL_PANEL_CLASS,
          "transition-transform duration-300 motion-reduce:transition-none",
          OVERLAY_EASE,
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className={SHEET_GRABBER_CLASS} />
        <RouteSheetCloseContext.Provider value={requestClose}>
          {children}
        </RouteSheetCloseContext.Provider>
      </div>
    </div>
  );
}

/** The sheet's title row: the title on the left, a plain X on the right —
 *  the person card's close (MESITA-2709; Pato, MESITA-2715: "give the route
 *  sheet header (Ask AI) the same plain X as the person card"; a 44px
 *  bordered disc before). Only the 20px ink glyph shows, flush with the
 *  row's px-4 inset (-mr-3 pulls the 44px button's 12px of air past it);
 *  the tap target is invisible until a hover draws the muted disc. */
export function RouteSheetHeader({ title }: { title: string }) {
  const close = useContext(RouteSheetCloseContext);
  const router = useRouter();
  return (
    <header className="flex shrink-0 items-center gap-2 px-4 pt-2 pb-1">
      <h2 className="font-display min-w-0 flex-1 truncate text-base font-semibold">
        {title}
      </h2>
      <button
        type="button"
        onClick={close ?? (() => router.back())}
        aria-label="Close"
        className="text-foreground hover:bg-muted focus-visible:ring-ring -mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition outline-none focus-visible:ring-2"
      >
        <X className="h-5 w-5" strokeWidth={2.25} aria-hidden />
      </button>
    </header>
  );
}
