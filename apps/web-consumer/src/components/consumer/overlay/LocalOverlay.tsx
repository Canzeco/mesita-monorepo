"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  OVERLAY_EASE,
  overlayExitMs,
} from "@/components/consumer/overlay/overlay-presence";
import { APP_CARD_ID } from "@/components/consumer/MobileFrame";

// State-driven overlays (no route change): bottom sheets and centered
// dialogs opened by component state — filters, verify social, social
// profiles. Same motion language as the route modals (SlideOverShell /
// BottomSheetShell) so every layer in the app opens and closes the same way.
//
// Positioning: by default these PORTAL into the MobileFrame card
// (APP_CARD_ID) so the backdrop covers the WHOLE app — chrome bands
// included — without `fixed` (which escapes the card on desktop and dims
// the entire monitor). Rendering in place would anchor to whatever
// positioned ancestor happens to be nearest (the VerifySocialSheet bug:
// TopBar/BottomNav stayed visible and clickable). z-[130] sits above the
// route-modal host (z-[120]) and below the Toaster (z-[140]).
//
// Presence: the parent just flips `open`. When `open` goes false the
// overlay plays the exit transition before unmounting (or, with
// `keepMounted`, before going inert — use that when closed state must
// survive, e.g. FilterSheet selections).

function useLocalPresence(open: boolean) {
  // `shown` drives the CSS transition classes; `mounted` keeps the DOM alive
  // through the exit transition.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // All state flips happen inside rAF/timeout callbacks (never in the
    // effect body — react-hooks/set-state-in-effect). On open that also
    // gives the double-rAF beat: mount the closed frame first or the enter
    // transition gets batched away and the overlay pops (see
    // overlay-presence.ts).
    if (open) {
      let second = 0;
      const first = requestAnimationFrame(() => {
        setMounted(true);
        second = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    const raf = requestAnimationFrame(() => setShown(false));
    const t = window.setTimeout(() => setMounted(false), overlayExitMs());
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [open]);

  return { mounted, shown };
}

function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, onClose]);
}

// Resolves the card portal target after mount (SSR-safe). Falls back to
// in-place rendering if the card isn't in the DOM (tests, storybook).
function useCardContainer() {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // rAF keeps the setState out of the effect body (compiler lint); one
    // frame of delay before the portal resolves is invisible.
    const raf = requestAnimationFrame(() =>
      setEl(document.getElementById(APP_CARD_ID)),
    );
    return () => cancelAnimationFrame(raf);
  }, []);
  return el;
}

function CardPortal({ children }: { children: React.ReactNode }) {
  const card = useCardContainer();
  if (!card) return null;
  return createPortal(children, card);
}

export function LocalSheet({
  open,
  onClose,
  children,
  ariaLabel,
  keepMounted = false,
  panelClassName,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel: string;
  keepMounted?: boolean;
  panelClassName?: string;
}) {
  const { mounted, shown } = useLocalPresence(open);
  useEscape(open, onClose);

  if (!mounted && !keepMounted) return null;

  return (
    <CardPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-hidden={!open}
        className={cn(
          "absolute inset-0 z-[130] flex flex-col justify-end overflow-hidden",
          !open && "pointer-events-none",
        )}
      >
        <button
          type="button"
          aria-label="Close"
          tabIndex={-1}
          onClick={onClose}
          className={cn(
            "absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none",
            shown ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "border-border bg-popover shadow-elev relative flex max-h-[85%] min-h-0 flex-col overflow-hidden rounded-t-3xl border-t",
            "transition-transform duration-300 motion-reduce:transition-none",
            OVERLAY_EASE,
            shown ? "translate-y-0" : "translate-y-full",
            panelClassName,
          )}
        >
          <div className="bg-foreground/20 mx-auto mt-2 h-1 w-10 shrink-0 rounded-full" />
          {children}
        </div>
      </div>
    </CardPortal>
  );
}

export function LocalDialog({
  open,
  onClose,
  children,
  ariaLabel,
  panelClassName,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel: string;
  panelClassName?: string;
}) {
  const { mounted, shown } = useLocalPresence(open);
  useEscape(open, onClose);

  if (!mounted) return null;

  return (
    <CardPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="absolute inset-0 z-[130] flex items-center justify-center overflow-hidden p-5"
      >
        <button
          type="button"
          aria-label="Close"
          tabIndex={-1}
          onClick={onClose}
          className={cn(
            "absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none",
            shown ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "border-border bg-popover shadow-elev relative w-full max-w-sm overflow-hidden rounded-3xl border",
            "transition-[opacity,transform] duration-300 motion-reduce:transition-none",
            OVERLAY_EASE,
            shown ? "scale-100 opacity-100" : "scale-95 opacity-0",
            panelClassName,
          )}
        >
          {children}
        </div>
      </div>
    </CardPortal>
  );
}
