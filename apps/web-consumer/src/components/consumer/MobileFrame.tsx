import { cn } from "@/lib/utils";

/**
 * Consumer surface frame.
 *
 * Two-box model:
 *   - Outer: gradient page background. Mobile uses STRICT viewport
 *     height (\`h-dvh\`) so the inner card can never grow past the
 *     visible viewport. Desktop uses \`min-h-dvh\` + py padding so the
 *     card is centered on the hero gradient with breathing room.
 *   - Card: the actual app surface. STRICT height on mobile
 *     (\`h-full\` of the outer = h-dvh), capped \`max-h\` on desktop.
 *     The shell layout inside lays out as flex-col:
 *       [StatusBar][body flex-1][BottomNav]
 *     With a strict card height, BottomNav as a shrink-0 flex child
 *     sits at the bottom of the viewport, and the body's own
 *     \`overflow-y-auto\` scrolls inside the available space — neither
 *     chrome band can scroll out of view.
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
  return (
    <div className="bg-background md:bg-hero flex h-dvh items-stretch justify-center md:h-auto md:min-h-dvh md:py-6">
      <div
        id={APP_CARD_ID}
        className={cn(
          // A full border on every side frames the surface. On mobile most
          // pages have no top header, so without this the app background runs
          // flush to the viewport edge and scrolling reads as one boundless
          // sheet — the border gives the screen a contained edge all around.
          "bg-background border-border relative flex h-full w-full max-w-md flex-col overflow-hidden border",
          // Rounded corners, elevation, and the height cap only kick in at md+.
          "md:shadow-elev md:h-auto md:max-h-[min(900px,calc(100dvh-3rem))] md:rounded-3xl",
        )}
      >
        <div className={cn("flex flex-1 flex-col overflow-hidden", className)}>
          {children}
        </div>
      </div>
    </div>
  );
}
