"use client";

import { useCallback, useRef } from "react";

// A LIST KEEPS ITS PLACE (MESITA-3647). Back slides the screen on top away
// and uncovers the one under it; that one is a fresh mount, so its scroller
// started at the top and the row you tapped was gone. Each scroller that
// takes this ref remembers its offset per address for the session (memory
// only) and returns to it when its screen mounts again. Screens read their
// data from the screen cache (lib/screen-cache.ts), so the rows are there on
// the first frame; a second try one frame later covers a list that grows a
// beat after mount.

const kept = new Map<string, number>();

function here(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/** A ref callback for a scroller: restores its offset on mount, records it
 *  on every scroll. */
export function useKeptScroll<T extends HTMLElement>(): (el: T | null) => void {
  const cleanup = useRef<(() => void) | null>(null);
  return useCallback((el: T | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el) return;
    const key = here();
    const top = kept.get(key) ?? 0;
    if (top > 0) {
      el.scrollTop = top;
      requestAnimationFrame(() => {
        if (el.scrollTop < top) el.scrollTop = top;
      });
    }
    const onScroll = () => kept.set(key, el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    cleanup.current = () => el.removeEventListener("scroll", onScroll);
  }, []);
}
