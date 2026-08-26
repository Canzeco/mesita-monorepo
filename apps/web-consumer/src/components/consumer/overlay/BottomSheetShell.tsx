"use client";

import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OVERLAY_BACKDROP_CLASS,
  OVERLAY_EASE,
  useOverlayPresence,
} from "@/components/consumer/overlay/overlay-presence";
import { isModalContractPath } from "@/lib/consumer-route-contract";
import { SEMI_MODAL_PANEL_CLASS } from "@/components/consumer/overlay/LocalOverlay";
import { SHEET_GRABBER_CLASS } from "@/lib/ui-classes";

// Route-modal bottom sheet: slides up from the bottom edge and stops short
// of the top so the underlying surface stays visible behind a dimmed
// backdrop. This is the chrome for "companion" route modals (Filters,
// live-visit ticket) where the user should keep their sense of place; full
// detail modals use SlideOverShell instead.
//
// Same contracts as SlideOverShell: mount from the intercepted segment's
// layout.tsx so the enter animation plays once across the loading → page
// swap; `absolute` positioning only; dismiss plays the exit slide, then
// router.back().
//
// `hideHeader` — child owns title / Reset / close. Body then does NOT scroll;
// the child keeps sticky header + footer. Its only user was the discovery
// Filters sheet, deleted in MESITA-1183; the option stays for the next child
// that needs to own its own chrome.

export function BottomSheetShell({
  children,
  title = "Your visit",
  hideHeader = false,
}: {
  children: React.ReactNode;
  title?: string;
  /** When true, only grab + flex body (child owns header/footer/scroll). */
  hideHeader?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const onModalRoute = isModalContractPath(pathname);
  const { open, requestClose } = useOverlayPresence(() => router.back(), {
    active: onModalRoute,
  });

  // Stale-slot guard — see SlideOverShell: hides the sheet if a soft nav
  // from inside it moved the URL off the modal routes.
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
        aria-label={title}
        className={cn(
          // The SAME panel as every state-driven sheet (decision: Pato,
          // 2026-08-22). This used to be its own recipe — 90% instead of
          // 85%, 2xl corners instead of 3xl, bg-background instead of
          // bg-popover, a different shadow — which meant the ticket sheet
          // and the Class sheet were visibly different objects for a reason
          // no guest can perceive: one changes the URL and the other does
          // not.
          SEMI_MODAL_PANEL_CLASS,
          "transition-transform duration-300 motion-reduce:transition-none",
          OVERLAY_EASE,
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className={SHEET_GRABBER_CLASS} />

        {!hideHeader && (
          <header className="flex shrink-0 items-center gap-2 px-3 pt-2 pb-3">
            <span className="h-8 w-8 shrink-0" />
            <p className="font-display flex-1 truncate text-center text-sm font-semibold">
              {title}
            </p>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="border-border bg-card text-foreground hover:bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition"
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </header>
        )}

        <div
          className={cn(
            "min-h-0 flex-1",
            hideHeader ? "flex flex-col overflow-hidden" : "overflow-y-auto",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
