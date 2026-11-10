"use client";

import {
  ViewTransition,
  addTransitionType,
  startTransition,
  useEffect,
} from "react";
import { usePathname } from "next/navigation";
import {
  NAV_POP,
  NAV_PUSH,
  currentEntryIndex,
  noteTraverse,
  takePanelExit,
} from "@/lib/navigate";

// THE STAGE EVERY SCREEN STANDS ON (MESITA-3644). The shell's body (the
// screen, the tab placeholder and the @modal host) sits in one React
// <ViewTransition>. A navigation tagged `nav-push` (lib/navigate.ts) has the
// browser photograph the old screen and slide the new one in from the right
// over it; `nav-pop` slides the screen away to the right, uncovering the one
// under it. Anything untagged — a bar tab, a redirect, data landing — swaps
// as it always did. The bar sits outside the stage and never moves.
//
// Back and Forward reach Next as a popstate with no type. Next answers the
// popstate synchronously inside a Transition, so a type added here in the
// same event rides on Next's own traversal. Skipped when the browser already
// animated the move (Safari's edge swipe) or when a panel just slid itself
// out (its close is a Back, and the panel has already left).

const STAGE_MOTION = {
  [NAV_PUSH]: "screen-push",
  [NAV_POP]: "screen-pop",
  default: "none",
} as const;

// The history index of the screen on show, to tell Back from Forward. Set
// after each commit; a popstate reads it before the new screen commits.
let shown: number | null = null;

export function ScreenStage({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    shown = currentEntryIndex();
  }, [pathname]);

  useEffect(() => {
    let browserAnimated = false;

    const nav = (
      window as unknown as {
        navigation?: EventTarget;
      }
    ).navigation;
    function onNavigate(e: Event) {
      browserAnimated =
        (e as Event & { hasUAVisualTransition?: boolean })
          .hasUAVisualTransition === true;
    }
    nav?.addEventListener("navigate", onNavigate);

    function onPopState() {
      noteTraverse(true);
      const now = currentEntryIndex();
      const forward = now !== null && shown !== null && now > shown;
      const skip = takePanelExit() || browserAnimated;
      browserAnimated = false;
      if (skip) return;
      startTransition(() => {
        addTransitionType(forward ? NAV_PUSH : NAV_POP);
      });
    }
    // A tap starts a new move: a panel it opens slides in again.
    function onPointer() {
      noteTraverse(false);
    }
    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onPointer, true);
    return () => {
      nav?.removeEventListener("navigate", onNavigate);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onPointer, true);
    };
  }, []);

  return (
    <ViewTransition
      name="screen-stage"
      update={STAGE_MOTION}
      enter="none"
      exit="none"
      share="none"
      default="none"
    >
      {/* The one box the browser photographs: a real element. */}
      <div
        data-screen-stage=""
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {children}
      </div>
    </ViewTransition>
  );
}
