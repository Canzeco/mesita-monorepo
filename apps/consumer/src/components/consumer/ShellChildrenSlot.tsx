"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { Loader2 } from "lucide-react";

// Wraps the (shell)/layout.tsx `children` slot so we can hide it whenever
// the @modal slot is actively intercepting a route.
//
// Why: with parallel routes, soft-navving from /discover/catalog →
// /venues/[id] mounts the hard-nav page in `children` AND the modal
// intercept in `@modal` simultaneously. If both are visible during the
// modal's slide-in animation, the user sees the underlying full-page
// render of the same venue underneath the sliding pane — the venue is
// rendered twice and the transition reads as janky overlap.
//
// useSelectedLayoutSegment("modal") returns the current segment of the
// @modal slot — null when the slot is showing default.tsx, otherwise the
// matched route segment. When non-null, we know an intercept is active,
// so we collapse the children slot. The modal then has the visible area
// to itself; the slide-in reveals onto a clean background instead of
// the hard-nav full-page-of-the-same-venue.
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
//
// Slide-in placeholder: while the modal is active, we also render a
// centered spinner in the body wrapper as a sibling of the hidden
// children. The body wrapper is `relative`; the spinner is `absolute
// inset-0`. The modal lives at z-50 inside the outer wrapper that
// contains body + nav, so the moment it finishes sliding in over the
// body it covers the spinner. The spinner is only visible during the
// ~300ms slide-in — without it, the part of the body not yet covered
// by the modal showed as a white flash.

export function ShellChildrenSlot({ children }: { children: React.ReactNode }) {
  const modalSegment = useSelectedLayoutSegment("modal");
  const modalActive = modalSegment !== null && modalSegment !== "__DEFAULT__";
  if (modalActive) {
    return (
      <>
        {/* Children kept in the React tree but display:none so the
            hard-nav /venues/[id]/page.tsx doesn't render alongside the
            modal (same venue duplicated would read as janky overlap). */}
        <div className="hidden">{children}</div>
        {/* Visible loading placeholder behind the sliding-in modal. */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <Loader2
            className="text-muted-foreground h-5 w-5 animate-spin"
            aria-label="Loading"
          />
        </div>
      </>
    );
  }
  return <div className="contents">{children}</div>;
}
