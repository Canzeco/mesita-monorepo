import { cn } from "@/lib/utils";

/**
 * Business surface frame — the venue console is a mobile-first web app
 * (mirrors mesita-web-consumer's MobileFrame).
 *
 * Two-box model:
 *   - Outer: page background. Mobile uses STRICT viewport height
 *     (`h-dvh`) so the inner card can never grow past the visible
 *     viewport. Desktop uses `min-h-dvh` + py padding so the card is
 *     centered on the hero gradient with breathing room.
 *   - Card: the actual app surface. STRICT height on mobile (`h-full`
 *     of the outer = h-dvh), capped `max-h` on desktop. The shell inside
 *     lays out as flex-col: [StatusBar][TopBar][body flex-1][BottomNav].
 *     With a strict card height, BottomNav as a shrink-0 flex child sits
 *     at the bottom of the viewport and the body's own `overflow-y-auto`
 *     scrolls inside the available space — neither chrome band scrolls
 *     out of view.
 */
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
        className={cn(
          "bg-background flex h-full w-full max-w-md flex-col overflow-hidden",
          // Card chrome + height cap only kick in at md+.
          "md:border-border md:shadow-elev md:h-auto md:max-h-[min(900px,calc(100dvh-3rem))] md:rounded-3xl md:border",
        )}
      >
        <div className={cn("flex flex-1 flex-col overflow-hidden", className)}>
          {children}
        </div>
      </div>
    </div>
  );
}
