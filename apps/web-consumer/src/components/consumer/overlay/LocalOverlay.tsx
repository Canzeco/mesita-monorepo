"use client";

import { Z_LOCAL_OVERLAY } from "@/lib/z-index";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  OVERLAY_BACKDROP_CLASS,
  OVERLAY_EASE,
  overlayExitMs,
} from "@/components/consumer/overlay/overlay-presence";
import { SHEET_GRABBER_CLASS } from "@/lib/ui-classes";
import { APP_CARD_ID } from "@/components/consumer/MobileFrame";

// State-driven overlays (no route change): bottom sheets and centered
// dialogs opened by component state — Contact, Coming soon, Reserve.
// Same motion language as the route modal shell (SlideOverShell).
//
// Positioning: by default these PORTAL into the MobileFrame card
// (APP_CARD_ID) so the backdrop covers the WHOLE app — chrome bands
// included — without `fixed` (which escapes the card on desktop and dims
// the entire monitor). Rendering in place would anchor to whatever
// positioned ancestor happens to be nearest, leaving TopBar/BottomNav
// visible and clickable. z-[130] sits above the route-modal host (z-[120])
// and below the Toaster (z-[140]).
//
// Presence: the parent just flips `open`. When `open` goes false the
// overlay plays the exit transition before unmounting.

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

// Focus in, focus back (MESITA-2939). Opening an overlay used to leave
// keyboard and screen-reader focus on the control behind the scrim; closing
// one dropped it on <body>. On open: remember what had focus, and once the
// panel mounts move focus to its first actionable control, or to the panel
// itself. A text field is never the first stop: focusing it pops the phone
// keyboard over a sheet the guest has not read yet, so the panel takes focus
// instead. A child that already placed focus inside (GeneratePlaceDialog's
// per-phase focus) is left alone. On close: return focus to the opener if it
// is still in the document and focus has not moved elsewhere meanwhile.
const ACTIONABLE =
  'button:not([disabled]):not([tabindex="-1"]), a[href]:not([tabindex="-1"]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

function isTextField(el: Element) {
  if (el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return ![
    "button",
    "checkbox",
    "radio",
    "submit",
    "reset",
    "range",
    "color",
    "file",
    "image",
  ].includes(el.type);
}

function useOverlayFocus(open: boolean) {
  const opener = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);

  const remember = useCallback((within: HTMLElement | null) => {
    if (opener.current) return;
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      active !== document.body &&
      !within?.contains(active)
    )
      opener.current = active;
  }, []);

  useEffect(() => {
    if (!open) return;
    remember(panel.current);
    return () => {
      const back = opener.current;
      opener.current = null;
      const active = document.activeElement;
      const stray =
        !active ||
        active === document.body ||
        (panel.current?.contains(active) ?? false);
      if (back?.isConnected && stray) back.focus({ preventScroll: true });
    };
  }, [open, remember]);

  // Callback ref: the panel mounts a frame or two after `open` flips
  // (presence + portal resolve), so an effect on `open` would find nothing.
  return useCallback(
    (node: HTMLDivElement | null) => {
      panel.current = node;
      if (!node || node.contains(document.activeElement)) return;
      remember(node);
      const first = node.querySelector<HTMLElement>(ACTIONABLE);
      const target = first && !isTextField(first) ? first : node;
      // preventScroll: the panel is still translated off-screen / scaled
      // down for its enter transition.
      target.focus({ preventScroll: true });
    },
    [remember],
  );
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

// THE SEMI-MODAL, AND THERE IS ONLY ONE (decision: Pato, 2026-08-22).
//
// A SHEET IS 88% OF THE CARD. Not "up to" 88% — exactly. (80% until Pato
// asked for Ask AI "taller, just a bit", MESITA-2489 — one panel, so every
// sheet rose with it.) Every sheet used to
// be `max-h` with no floor, so its height was a function of its own copy: the
// contact sheet opened as a strip, Instagram opened near 85%, and no two
// sheets in the app agreed on where the top edge lands. Height was carrying
// no information — it just leaked how much text the sheet happened to hold —
// while costing the one thing a repeated shape can give you, which is the
// feeling that you are still in the same app. A fixed edge also means the
// grabber, the title and the first row land in the same place every time, so
// the eye and the thumb both stop re-aiming.
//
// SHORT CONTENT DOES NOT GET A SHEET. The rule this would otherwise break is
// "no fixed tall empty panels" (Docs › Design §D) — a three-line confirm in
// an 88% panel is mostly dead space. So a confirm is not a short sheet: it is a
// LocalDialog, the centred shape below, which is sized by its content by
// design. Two shapes, chosen by what the surface IS, never by how long its
// copy ran.
//
// Any routed sheet shell must reuse this same panel, because a guest cannot
// tell a route modal from a state modal and should not have to.
export const SEMI_MODAL_PANEL_CLASS =
  "border-border bg-popover shadow-elev relative flex h-[88%] max-h-[88%] min-h-0 flex-col overflow-hidden rounded-t-3xl border-t";

export function LocalSheet({
  open,
  onClose,
  children,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  const { mounted, shown } = useLocalPresence(open);
  useEscape(open, onClose);
  const panelRef = useOverlayFocus(open);

  if (!mounted) return null;

  return (
    <CardPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-hidden={!open}
        className={cn(
          "absolute inset-0 flex flex-col justify-end overflow-hidden",
          Z_LOCAL_OVERLAY,
          !open && "pointer-events-none",
        )}
      >
        <button
          type="button"
          aria-label="Close"
          tabIndex={-1}
          onClick={onClose}
          className={cn(
            OVERLAY_BACKDROP_CLASS,
            shown ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          ref={panelRef}
          tabIndex={-1}
          className={cn(
            SEMI_MODAL_PANEL_CLASS,
            "outline-none",
            "transition-transform duration-300 motion-reduce:transition-none",
            OVERLAY_EASE,
            shown ? "translate-y-0" : "translate-y-full",
          )}
        >
          <div className={SHEET_GRABBER_CLASS} />
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
  instant = false,
  scroll = false,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel: string;
  /** Appear and disappear at once: no fade, no scale, no exit delay
   *  (Social's person card, MESITA-2546). Off for every other dialog. */
  instant?: boolean;
  /** A tall dialog: the panel stops at the overlay's height and its child
   *  is the scroller (Social's person card, MESITA-2845). Still sized by its
   *  content below that. Off for every other dialog. */
  scroll?: boolean;
}) {
  const presence = useLocalPresence(open);
  const mounted = instant ? open : presence.mounted;
  const shown = instant ? open : presence.shown;
  useEscape(open, onClose);
  const panelRef = useOverlayFocus(open);

  if (!mounted) return null;

  return (
    <CardPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn(
          "absolute inset-0 flex items-center justify-center overflow-hidden p-5",
          Z_LOCAL_OVERLAY,
          // A closing dialog stays mounted for its exit fade; without this
          // its invisible backdrop ate taps on the whole card, the bottom bar
          // included (MESITA-2762). LocalSheet already does the same.
          !open && "pointer-events-none",
        )}
      >
        <button
          type="button"
          aria-label="Close"
          tabIndex={-1}
          onClick={onClose}
          className={cn(
            OVERLAY_BACKDROP_CLASS,
            instant && "transition-none",
            shown ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          ref={panelRef}
          tabIndex={-1}
          className={cn(
            "border-border bg-popover shadow-elev relative w-full max-w-sm overflow-hidden rounded-3xl border outline-none",
            scroll && "flex max-h-full min-h-0 flex-col",
            !instant &&
              "transition-[opacity,transform] duration-300 motion-reduce:transition-none",
            !instant && OVERLAY_EASE,
            shown ? "scale-100 opacity-100" : "scale-95 opacity-0",
          )}
        >
          {children}
        </div>
      </div>
    </CardPortal>
  );
}
