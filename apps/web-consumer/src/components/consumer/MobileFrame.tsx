"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";

/**
 * Consumer surface frame — a mobile / vertical visualizer.
 *
 * Two-box model:
 *   - Outer: gradient page background. Mobile uses STRICT viewport
 *     height (\`h-dvh\`) so the inner card can never grow past the
 *     visible viewport. Desktop centers the card on the hero gradient
 *     with only a thin margin (\`py-4\`).
 *   - Card: the actual app surface. STRICT height on BOTH breakpoints —
 *     \`h-full\` (= h-dvh) on mobile, \`h-[calc(100dvh-2rem)]\` on desktop —
 *     so the visualizer fills almost the entire viewport height and
 *     leaves just a small margin. Width stays mobile-narrow (\`max-w-md\`);
 *     it's a vertical visualizer, not a desktop layout.
 *     The shell layout inside lays out as flex-col:
 *       [body flex-1][BottomNav]
 *     With a strict card height, BottomNav as a shrink-0 flex child
 *     sits at the bottom of the viewport, and the body's own
 *     \`overflow-y-auto\` scrolls inside the available space — the chrome
 *     band can never scroll out of view.
 *
 * The strict height is load-bearing: without it, anything that pushed
 * past viewport (a long loading skeleton, a tall page, a slow paint)
 * grew the card past the viewport and pushed BottomNav below the fold.
 * \`min-h-dvh\` made that worse on mobile because address-bar show/hide
 * recomputes the viewport mid-paint.
 */
// Portal target for overlays that must cover the WHOLE card (chrome bands
// included) without using `fixed` — fixed escapes the card on desktop.
// LocalSheet/LocalDialog and the Toaster anchor to this element.
export const APP_CARD_ID = "mesita-app-card";

export function MobileFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // The software keyboard, as a length both breakpoints can subtract.
  //
  // The frame is the RIGHT place for this: it is `h-dvh` and BottomNav is a
  // flow child, so shrinking here reflows the tab bar, the map's results panel
  // and every sticky footer in one move. Patching each surface would leave the
  // next one to rediscover the bug. `--kb` is 0px whenever the keyboard is
  // closed, so the calc() collapses to the value it always had.
  const keyboardInset = useKeyboardInset();

  return (
    <div
      className="bg-background md:bg-hero flex h-[calc(100dvh-var(--kb,0px))] items-stretch justify-center md:min-h-[calc(100dvh-var(--kb,0px))] md:items-center md:py-4"
      style={{ "--kb": `${keyboardInset}px` } as CSSProperties}
    >
      <div
        id={APP_CARD_ID}
        className={cn(
          // A full border on every side frames the surface. On mobile most
          // pages have no top header, so without this the app background runs
          // flush to the viewport edge and scrolling reads as one boundless
          // sheet — the border gives the screen a contained edge all around.
          "bg-background border-border relative flex h-full w-full max-w-md flex-col overflow-hidden border",
          // Desktop: fill almost the whole viewport height (thin py-4 margin),
          // keeping the mobile-narrow width — a tall vertical visualizer.
          // Rounded corners + elevation only kick in at md+.
          "md:shadow-elev md:h-[calc(100dvh-2rem-var(--kb,0px))] md:rounded-3xl",
        )}
      >
        <div className={cn("flex flex-1 flex-col overflow-hidden", className)}>
          {children}
        </div>
      </div>
    </div>
  );
}
