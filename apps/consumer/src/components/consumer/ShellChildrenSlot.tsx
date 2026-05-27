"use client";

import { useSelectedLayoutSegment } from "next/navigation";

// Wraps the (shell)/layout.tsx `children` slot so we can hide it whenever
// the @modal slot is actively intercepting a route.
//
// Why: with parallel routes, soft-navving from /discover/catalog →
// /venues/[id] mounts the hard-nav page in `children` AND the modal
// intercept in `@modal` simultaneously. During the modal's slide-in
// animation, the user sees the underlying full-page render of the same
// venue underneath the sliding pane — looks like the venue is rendered
// twice (it is) and the transition reads as janky overlap.
//
// useSelectedLayoutSegment("modal") returns the current segment of the
// @modal slot — null when the slot is showing default.tsx, otherwise the
// matched route segment. When non-null, we know an intercept is active,
// so we collapse the children slot. The modal then has the visible area
// to itself and the slide-in reveals onto a clean black background
// instead of the hard-nav full-page-of-the-same-venue.
//
// We use `hidden` (display: none) rather than `invisible` (visibility:
// hidden) because:
//   - display: none removes the children from layout entirely, so the
//     modal can position absolute inset-0 cleanly without the children
//     contributing scroll height
//   - visibility: hidden would still steal scroll position / focus from
//     the modal
//
// The children unmount/remount cost is fine — the modal close path is
// router.back() which restores children from cache anyway.

export function ShellChildrenSlot({ children }: { children: React.ReactNode }) {
  const modalSegment = useSelectedLayoutSegment("modal");
  const modalActive = modalSegment !== null && modalSegment !== "__DEFAULT__";
  return (
    <div className={modalActive ? "hidden" : "contents"}>
      {children}
    </div>
  );
}
