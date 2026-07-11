"use client";

import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OVERLAY_EASE,
  useOverlayPresence,
} from "@/components/consumer/overlay/overlay-presence";
import { isModalContractPath } from "@/lib/consumer-route-contract";

// Route-modal bottom sheet: slides up from the bottom edge and stops short
// of the top so the underlying surface stays visible behind a dimmed
// backdrop. This is the chrome for "companion" route modals (the live-visit
// ticket) where the user should keep their sense of place; full detail
// modals use SlideOverShell instead.
//
// Same contracts as SlideOverShell: mount from the intercepted segment's
// layout.tsx so the enter animation plays once across the loading → page
// swap; `absolute` positioning only; dismiss plays the exit slide, then
// router.back().

export function BottomSheetShell({
  children,
  title = "Your visit",
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const onModalRoute = isModalContractPath(pathname);
  const { open, requestClose } = useOverlayPresence(() => router.back(), {
    active: onModalRoute,
  });

  // Stale-slot guard — see SlideOverShell: hides the sheet if a soft nav
  // from inside it moved the URL off the modal routes.
  if (!onModalRoute) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex flex-col justify-end overflow-hidden">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={requestClose}
        className={cn(
          "absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "bg-background border-border relative flex max-h-[90%] min-h-0 flex-col overflow-hidden rounded-t-2xl border-t shadow-[0_-12px_32px_rgba(0,0,0,0.25)]",
          "transition-transform duration-300 motion-reduce:transition-none",
          OVERLAY_EASE,
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="bg-foreground/20 mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full" />

        <header className="flex shrink-0 items-center gap-2 px-3 pt-2 pb-3">
          <span className="h-8 w-8 shrink-0" />
          <p className="font-display flex-1 truncate text-center text-sm font-semibold">
            {title}
          </p>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="border-border bg-card text-foreground hover:bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
