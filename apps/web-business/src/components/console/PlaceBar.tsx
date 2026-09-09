// Row 2 — the place's own header line (MESITA-1558).
//
// Name and state on the left, the tab rail on the right. Renders only on a
// place route; every other screen keeps the one-row header it has today.
//
// WHERE THIS LIVES IS THE DESIGN. It is rendered by places/[id]/layout.tsx
// INSIDE PlaceManageShell, so the guarded variant of the tab rail can reach
// PlaceProvider. A parallel route slot — the obvious way to put a bar in a
// parent layout — is a SIBLING of that provider and can never reach it, which
// would freeze the discard bug GuardedPlaceTabs exists to fix.
//
// FULL BLEED: SHELL_BLEED is exactly the negative of <main>'s SHELL_GUTTER, so
// the border spans the window and the two bars read as one block of chrome
// rather than a bar sitting on a card. This only works because <main> is
// uncapped — with a max-width the bleed would stop at the cap. It is the only
// negative-margin breakout in this app now (the one it was modelled on,
// SubTabs.tsx, was deleted with the legacy console in #1513), so: -mx-* cancels
// the parent's padding, px-* puts it back inside, and `w-full` must NOT be
// added — a flex item only widens past its line when its width stays `auto`.

import { PlaceStateBadge } from "@/components/console/badges";
import { GuardedPlaceTabs } from "@/components/console/GuardedPlaceTabs";
import { PlaceTabs } from "@/components/console/PlaceTabs";
import {
  PLACEBAR_STICKY_CLASS,
  SHELL_BLEED,
  SHELL_GUTTER,
} from "@/lib/ui-classes";
import type { PlaceTab } from "@/lib/place-tabs";

export function PlaceBar({
  placeId,
  name,
  tabs,
  organizationId,
  verified,
  listed,
  guarded,
}: {
  placeId: string;
  name: string;
  tabs: PlaceTab[];
  organizationId: string | null;
  verified: boolean;
  listed: boolean;
  /** True on a held place, where PlaceProvider exists and tab navigation must
   *  route through the discard guard. False on a pool place, which has no
   *  provider and nothing to discard. */
  guarded: boolean;
}) {
  return (
    // `top-0`, flat, at every width (MESITA-1710). This used to park at 57px
    // above `sm` to clear the old top bar. The nav is a lateral rail now and
    // AppShell makes `main` the only scroller, so this bar's scrollport has
    // nothing above it — see PLACEBAR_STICKY_CLASS for the full argument.
    // z-20 sits under the drawer's z-50 and PlaceSaveBar's z-40.
    // A <div>, not a second <header>: only one banner landmark per document.
    <div
      className={`bg-background border-border z-20 flex flex-col justify-end gap-1 border-b pt-2 sm:h-12 sm:flex-row sm:items-center sm:gap-3 sm:pt-0 ${PLACEBAR_STICKY_CLASS} ${SHELL_BLEED} ${SHELL_GUTTER}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {/* An h1, kept small. The document outline needs one — Section renders
            h3, so without this the place screen's first heading is an h3 with
            h1 and h2 both skipped, which axe flags and VoiceOver's rotor has
            nothing to land on. `font-sans` is explicit because globals.css
            gives every bare h1/h2/h3 the display face, and Pato's call on this
            exact chrome in admin was "Inter, not Fraunces — this is identity,
            not a page title". min-w-0 lets it actually truncate; without it a
            flex child refuses to shrink and shoves the tabs off screen. */}
        <h1
          title={name}
          className="font-sans min-w-0 truncate text-base font-semibold tracking-tight sm:text-lg"
        >
          {name}
        </h1>
        {verified ? (
          <PlaceStateBadge state="verified" />
        ) : listed ? (
          <PlaceStateBadge state="listed" />
        ) : null}
      </div>

      <div className="min-w-0 sm:ml-auto">
        {guarded ? (
          <GuardedPlaceTabs
            placeId={placeId}
            tabs={tabs}
            organizationId={organizationId}
          />
        ) : (
          <PlaceTabs
            placeId={placeId}
            tabs={tabs}
            organizationId={organizationId}
          />
        )}
      </div>
    </div>
  );
}
