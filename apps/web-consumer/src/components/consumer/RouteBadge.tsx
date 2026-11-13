"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { Z_ROUTE_BADGE } from "@/lib/z-index";

import { BESIDE_CARD, useConsoleMode, useHydrated } from "./console-layout";

/**
 * Prints the current route into the page.
 *
 * The app renders inside MobileFrame's centered card, and the browsers we
 * actually QA in (the in-app preview pane, screenshot harnesses) show no
 * address bar — so the URL is invisible in a screenshot. That hurts here
 * more than in most apps, because the route carries meaning the pixels
 * don't: `/place/[id]` lights Home while `/reservation/[id]` lights Me, and
 * an `@modal` intercept looks identical to its hard twin.
 *
 * Placement follows the frame. On desktop it parks right of the card,
 * over the call log, overlapping nothing. Narrow viewports have no gutter, so it
 * sits translucent over the top-left corner — `pointer-events-none`
 * throughout, so it can never eat a tap meant for the app.
 */
export function RouteBadge() {
  // usePathname needs no Suspense boundary, so the path is in the
  // server-rendered HTML. useSearchParams does, and opts its subtree into
  // client rendering — hence the split: the path paints immediately and the
  // query string fills in on hydration.
  const pathname = usePathname() ?? "/";
  const mode = useConsoleMode();
  // Secondary to the phone: joins after hydration, never in the first paint.
  if (!useHydrated()) return null;

  return (
    <div
      aria-hidden
      data-testid="route-badge"
      className={cn(
        "pointer-events-none fixed top-2 left-2 select-none",
        // Desktop: 0.75rem right of the card, wherever the console mode
        // puts it (console-layout.ts, MESITA-3580).
        BESIDE_CARD[mode],
        "bg-card/80 text-muted-foreground border-border rounded-full border px-2.5 py-1",
        "type-label font-mono leading-none tracking-tight tabular-nums backdrop-blur-sm",
        Z_ROUTE_BADGE,
      )}
    >
      {pathname}
      <Suspense fallback={null}>
        <RouteBadgeQuery />
      </Suspense>
    </div>
  );
}

function RouteBadgeQuery() {
  const search = useSearchParams().toString();
  return search ? <>?{search}</> : null;
}
