"use client";

import { useEffect, useState } from "react";
import { ChevronsDown } from "lucide-react";

// The one-time "there is more below" hint.
//
// A NEW STORAGE KEY, AND THAT IS THE WHOLE POINT. The stack deck's hint used
// `mesita:swipe-tutorial-seen`, and that flag is ALREADY SET for every guest
// who ever opened Home. Reusing it would have shipped a hint that shows to
// nobody — the failure being invisible is what makes it worth a comment.
//
// It is the TEACHER now. The first card used to leave the next one peeking
// under the fold; the TikTok card (MESITA-2105) fills the screen exactly, so
// this one-time line, centred over the photo, is what says "scroll". It gets
// out of the way on the first scroll.
//
// Not a modal, not a dialog, and `pointer-events-none` throughout — it sits
// over a snap scroller and must never eat the gesture it is describing.

// v2 (MESITA-2105): from a39d4f40 the deck rendered at 0px, so this hint
// "showed" — and marked itself seen — over a feed nobody could see. Every
// guest who opened Scroll in that window holds a seen flag for a hint they
// never saw, and with the peek gone this hint is now the only teacher.
const STORAGE_KEY = "mesita:scroll-hint-seen-v2";
const AUTO_DISMISS_MS = 4000;

function readSeen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private mode: treat as seen. A hint that reappears every session is
    // worse than one that never shows.
    return true;
  }
}

function writeSeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* quota / private mode — the hint just shows again next time */
  }
}

export function ScrollHint({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show || readSeen()) return;
    writeSeen();

    const dismiss = () => setVisible(false);
    // Scheduled, not called in the effect body — setState there cascades
    // renders (react-hooks/set-state-in-effect), the same hop every other
    // effect in this app makes.
    const raf = requestAnimationFrame(() => setVisible(true));
    const timer = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    // Any scroll at all means the hint worked; it should be gone before the
    // guest looks back up.
    window.addEventListener("scroll", dismiss, { capture: true, once: true });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("scroll", dismiss, { capture: true });
    };
  }, [show]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center"
    >
      <span className="bg-foreground/85 text-paper flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
        <ChevronsDown className="h-3.5 w-3.5 animate-bounce" strokeWidth={2.4} />
        Scroll for more places
      </span>
    </div>
  );
}
