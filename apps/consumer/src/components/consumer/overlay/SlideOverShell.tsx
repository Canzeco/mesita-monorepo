"use client";

import { createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OVERLAY_EASE,
  useOverlayPresence,
} from "@/components/consumer/overlay/overlay-presence";
import { isModalContractPath } from "@/lib/consumer-route-contract";

// THE detail-modal chrome: a full-height panel that pushes in from the right
// edge, iOS-navigation style, and slides back out on dismiss. Used by every
// route modal in the @modal slot (place / coupon / reservation) so opening a
// detail from any surface is one consistent gesture.
//
// Mounting contract: render this from the intercepted segment's layout.tsx,
// NOT its page.tsx. The layout survives the loading.tsx → page.tsx swap, so
// the panel slides in exactly once while the skeleton inside it resolves to
// content. Rendering it from page.tsx replays the slide when data lands.
//
// Positioning contract: `absolute` within the shell's z-[120] modal host —
// never `fixed`, which escapes the MobileFrame card on desktop.
//
// Dismiss is router.back() (after the exit transition) so the URL restores
// to whichever surface the user came from with its state intact.

const SlideOverCloseContext = createContext<(() => void) | null>(null);

// Animated close for anything rendered inside the panel (header back button,
// action bars, body links that should dismiss the modal first).
export function useSlideOverClose() {
  const close = useContext(SlideOverCloseContext);
  const router = useRouter();
  return close ?? (() => router.back());
}

export function SlideOverShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const onModalRoute = isModalContractPath(pathname);
  const { open, requestClose } = useOverlayPresence(() => router.back(), {
    active: onModalRoute,
  });

  // Stale-slot guard: Next.js keeps an unmatched @modal slot's last active
  // state on soft navigation, so a router.push() fired from inside the modal
  // (toast "View", reward links) would leave this panel painted over the new
  // page. If the URL no longer belongs to a modal route, render nothing.
  // Browser-back to the modal URL restores the slot — and this un-hides.
  if (!onModalRoute) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 overflow-hidden">
      {/* Backdrop is only visible while the panel is mid-slide (the panel is
          full-width), but that beat of dimming is what sells the "on top of
          the screen" layering. */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={requestClose}
        className={cn(
          "absolute inset-0 cursor-default bg-black/30 transition-opacity duration-300 motion-reduce:transition-none",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "bg-background absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden shadow-[-16px_0_40px_rgba(0,0,0,0.25)]",
          "transition-transform duration-300 motion-reduce:transition-none",
          OVERLAY_EASE,
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <SlideOverCloseContext.Provider value={requestClose}>
          {children}
        </SlideOverCloseContext.Provider>
      </div>
    </div>
  );
}

// Standard slide-over header: dismiss chevron, centered title, optional
// action buttons on the right. Every route modal uses this row so back/close
// affordances sit in the same place on every detail surface.
export function SlideOverHeader({
  title,
  actions,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const close = useSlideOverClose();
  return (
    <header className="bg-background/85 z-20 flex shrink-0 items-center gap-2 px-3 py-3 backdrop-blur">
      <button
        type="button"
        onClick={close}
        aria-label="Back"
        className="bg-card text-foreground border-border hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
      </button>
      <div className="font-display flex min-w-0 flex-1 items-center justify-center text-sm font-semibold">
        {typeof title === "string" ? (
          <span className="truncate">{title}</span>
        ) : (
          title
        )}
      </div>
      {actions ?? <span className="h-9 w-9 shrink-0" />}
    </header>
  );
}
