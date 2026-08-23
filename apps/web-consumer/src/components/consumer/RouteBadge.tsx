"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { Z_ROUTE_BADGE } from "@/lib/z-index";

/**
 * Prints the current route into the page.
 *
 * The app renders inside MobileFrame's centered card, and the browsers we
 * actually QA in (the in-app preview pane, screenshot harnesses) show no
 * address bar — so the URL is invisible in a screenshot. That hurts here
 * more than in most apps, because the route carries meaning the pixels
 * don't: `/visit/[id]` vs `/reservation/[id]` light the same tab, the
 * `?mode=` segments pick a Home mode, and an `@modal` intercept looks
 * identical to its hard twin.
 *
 * Placement follows the frame. On desktop it parks in the gutter beside
 * the card, overlapping nothing. Narrow viewports have no gutter, so it
 * sits translucent over the top-left corner — `pointer-events-none`
 * throughout, so it can never eat a tap meant for the app.
 */
export function RouteBadge() {
  // usePathname needs no Suspense boundary, so the path is in the
  // server-rendered HTML. useSearchParams does, and opts its subtree into
  // client rendering — hence the split: the path paints immediately and the
  // query string fills in on hydration.
  const pathname = usePathname();

  return (
    <div
      aria-hidden
      data-testid="route-badge"
      className={cn(
        "pointer-events-none fixed top-2 left-2 select-none",
        // Right edge lands 0.75rem left of the card, whose half-width is
        // 14rem (max-w-md in MobileFrame). If that width ever changes this
        // only drifts within the gutter — it never covers the card.
        "md:left-[calc(50%-14.75rem)] md:-translate-x-full",
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
