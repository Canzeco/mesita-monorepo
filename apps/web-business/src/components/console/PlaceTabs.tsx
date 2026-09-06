"use client";

// Row 2's tab rail. DUMB by construction: it takes everything as props and
// imports no context.
//
// That is load-bearing, not style. `usePlaceContext` THROWS outside its
// provider (PlaceContext.tsx:385) and the context itself is not exported, so
// there is no non-throwing escape hatch. A pool place has no provider — if
// this component reached for the context it would take down every unclaimed
// place. The guard arrives as `onNavigate`, supplied by GuardedPlaceTabs on
// the branch that HAS a provider.
//
// Treatment is admin's, not row 1's: an underline rail, not filled pills.
// Row 1's active item is a filled `bg-foreground` pill; if row 2 used the
// same, two solid pills would sit 56px apart with nothing saying one is a
// global destination and the other a section of this place. Admin solved this
// already (PlaceEditChrome underlines its tab row for exactly this reason).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PLACE_TAB_LABEL, placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import { cn } from "@/lib/utils";

export function PlaceTabs({
  placeId,
  tabs,
  organizationId = null,
  onNavigate,
}: {
  placeId: string;
  tabs: PlaceTab[];
  organizationId?: string | null;
  /** Routed through the unsaved-changes guard when a provider is present.
   *  Absent on pool places, which have no editable state to discard. */
  onNavigate?: (href: string, e: { preventDefault: () => void }) => void;
}) {
  const pathname = usePathname();
  return (
    // A SCROLLER, never `flex-wrap`. Four labels are ~305px of the 343px a
    // 375px phone offers, so wrapping inside a fixed-height bar clips the
    // second line outright. `w-max` on the inner row is what lets the track
    // exceed the rail and scroll instead of compressing.
    <nav
      className="scrollbar-none -mb-px flex max-w-full overflow-x-auto"
      aria-label="Place sections"
    >
      <div className="flex w-max items-stretch gap-1">
        {tabs.map((tab) => {
          const href = placeTabHref(placeId, tab, organizationId);
          const bare = placeTabHref(placeId, tab);
          const active =
            tab === "profile"
              ? pathname === bare
              : pathname === bare || pathname.startsWith(`${bare}/`);
          return (
            <Link
              key={tab}
              href={href}
              aria-current={active ? "page" : undefined}
              onClick={(e) => {
                // The tab you are already on goes nowhere, so guarding it
                // would open a "Discard & leave" dialog for a navigation that
                // was never going to happen.
                if (active) return;
                onNavigate?.(href, e);
              }}
              className={cn(
                // min-h-11 is the 44px touch minimum. The old pills were
                // ~30px, which is a miss on a phone.
                "relative flex min-h-11 shrink-0 items-center px-3 text-[13px] font-medium transition sm:min-h-12",
                active
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PLACE_TAB_LABEL[tab]}
              {active && (
                <span
                  aria-hidden="true"
                  className="bg-foreground absolute inset-x-2 bottom-0 h-[3px] rounded-t-full"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
