"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { clearPendingTabOff, usePendingTab } from "@/lib/pending-tab";
import { barePath } from "@/lib/surface";
import { cn } from "@/lib/utils";
import { Z_PENDING_SCREEN } from "@/lib/z-index";

// THE TAPPED TAB'S PLACEHOLDER PAINTS ON FINGER-DOWN (Pato, MESITA-2846:
// "i must be automatically and quickly directed to the respective page, if
// not data yet, then show the placeholders"). A route's loading.tsx only
// paints once Next has it from the server, and every navigation waits on the
// proxy's session check in Oregon first, so the old screen stood under a lit
// tab for that whole trip. The (shell) layout renders each tab's placeholder
// on the server once (`frames`, keyed by the tab's href) and this draws the
// pending one over the old screen the instant the bar is touched. The old
// screen stays mounted under it, so nothing it holds is lost if the guest
// comes back. When the new page commits the pathname moves, the overlay goes,
// and the page's own loading frame (the same placeholder) or the page itself
// is already there.
export function PendingScreen({
  frames,
}: {
  frames: Readonly<Record<string, ReactNode>>;
}) {
  const pathname = barePath(usePathname() ?? "/");
  const pending = usePendingTab(pathname);
  useEffect(() => clearPendingTabOff(pathname), [pathname]);
  const frame = pending ? frames[pending] : null;
  if (!frame) return null;
  return (
    <div
      className={cn(
        "bg-background absolute inset-0 flex flex-col",
        Z_PENDING_SCREEN,
      )}
    >
      {frame}
    </div>
  );
}
