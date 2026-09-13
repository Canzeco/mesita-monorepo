"use client";

// The place screen's title (MESITA-1714). Replaces PlaceBar.
//
// PlaceBar was a second sticky chrome row carrying the place's name, its state
// badge and the four view tabs. Once the rail carries the name AND the views,
// that bar restated both — 48px of permanent chrome, on the tallest screen in
// the console, saying what the column beside it already said. Deleted.
//
// What could NOT be deleted is the h1. `Section` renders h3, so without a
// heading here the place screen's first heading is an h3 with h1 and h2 both
// skipped: axe flags it and VoiceOver's rotor has nothing to land on. So the
// heading moves into the CONTENT FLOW, where a page title belongs, instead of
// living in a bar pinned above it. It scrolls away like any other title, which
// is the point — the rail is what stays.
//
// `font-sans` is explicit because globals.css gives every bare h1/h2/h3 the
// display face, and Pato's call on this exact chrome in admin was "Inter, not
// Fraunces — this is identity, not a page title."
//
// THE VIEW ROW (MESITA-1804). MESITA-1793 took the four views out of the rail
// and nothing else linked to them: Capabilities, Activity and Admin were
// reachable only by typing the URL. Until the scoped rail lands (the plan at
// ~/.gstack/.../rail-scoped-boxes-20260912.md carries the views again), the
// heading renders the place's view set as a row of pills under the title.
// The layout passes `tabs` (exactly `visibleTabs()`, 1 to 4) and `placeId`
// as PROPS, not via the OpenPlace context: the context is filled by an
// effect, so a row read from it would render empty on the server and pop in
// after hydration. One pill is filled: the view you are on. The row is not
// rendered for a single view (a pool place, Profile alone): a row with
// nowhere to go is chrome for nothing, so the muted label stays instead.
//
// `?org=` is carried through as the URL already answers it: the destination
// page resolves it exactly like every other page (foreign or absent falls
// back to the first organization), so passing the raw param on is the same
// rule the tab hrefs used in MESITA-1779. The rail PR that brings the views
// back deletes this row and its test: two surfaces naming the views is the
// restatement MESITA-1714 removed.
//
// Client because the view name comes from the pathname, and the layout that
// renders this cannot read it.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PlaceStateBadge } from "@/components/console/badges";
import { useOpenPlaceGuard } from "@/components/console/OpenPlace";
import {
  PLACE_TAB_LABEL,
  placeTabFromPathname,
  placeTabHref,
  type PlaceTab,
} from "@/lib/place-tabs";
import { cn } from "@/lib/utils";

// The same ink pill the rail uses for "you are here": one filled pill in the
// row, every other view quiet. Ring from `--ring`, the content column's own.
const PILL_BASE =
  "inline-flex items-center rounded-full px-3 py-1 text-[13px] font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-ring";
const PILL_REST = "text-muted-foreground hover:bg-muted hover:text-foreground";
const PILL_ACTIVE = "bg-foreground text-background font-semibold";

export function PlaceHeading({
  name,
  verified,
  listed,
  partner = false,
  placeId,
  tabs,
}: {
  name: string;
  verified: boolean;
  listed: boolean;
  /** Partnership is a place fact, not Listed/Verified — chip beside them. */
  partner?: boolean;
  placeId: string;
  /** Exactly the views this viewer may open — `visibleTabs()`, 1 to 4. */
  tabs: readonly PlaceTab[];
}) {
  const pathname = usePathname();
  const org = useSearchParams().get("org");
  const guardNav = useOpenPlaceGuard();
  // Same reader the rail uses (MESITA-1732). This was the second independent
  // copy of the bare-means-Profile rule; a routing rule written twice is one
  // copy too many, and the bare URL redirects now rather than rendering.
  const tab = placeTabFromPathname(pathname);
  const viewLabel = tab ? PLACE_TAB_LABEL[tab] : null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2">
        {/* min-w-0 lets it actually truncate; without it a flex child refuses
            to shrink and pushes the badge off screen. */}
        <h1
          title={name}
          className="font-sans min-w-0 truncate text-xl font-semibold tracking-tight sm:text-2xl"
        >
          {name}
        </h1>
        {verified ? (
          <PlaceStateBadge state="verified" />
        ) : listed ? (
          <PlaceStateBadge state="listed" />
        ) : null}
        {partner ? (
          <span className="border-border bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500 dark:bg-violet-400" />
            Partner
          </span>
        ) : null}
      </div>
      {/* Which view you are in, and the way to the others. With one view there
          is nowhere to go, so the name alone stays: a title that does not name
          the page it titles is half a title. */}
      {tabs.length > 1 ? (
        <nav aria-label="Place views" className="mt-1">
          <ul className="flex flex-wrap items-center gap-1">
            {tabs.map((t) => {
              const href = placeTabHref(placeId, t, org);
              const active = t === tab;
              return (
                <li key={t}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={(e) => {
                      // Never guard the pill you are on: that click goes
                      // nowhere, so asking to discard edits for it would
                      // throw work away for nothing (the rail's rule).
                      if (!active) guardNav?.(href, e);
                    }}
                    className={cn(PILL_BASE, active ? PILL_ACTIVE : PILL_REST)}
                  >
                    {PLACE_TAB_LABEL[t]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : (
        viewLabel && (
          <p className="text-muted-foreground text-[13px]">{viewLabel}</p>
        )
      )}
    </div>
  );
}
