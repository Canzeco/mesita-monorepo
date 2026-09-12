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
// Client because the view name comes from the pathname, and the layout that
// renders this cannot read it.

import { usePathname } from "next/navigation";
import { PlaceStateBadge } from "@/components/console/badges";
import { PLACE_TAB_LABEL, placeTabFromPathname } from "@/lib/place-tabs";

export function PlaceHeading({
  name,
  verified,
  listed,
  partner = false,
}: {
  name: string;
  verified: boolean;
  listed: boolean;
  /** Partnership is a place fact, not Listed/Verified — chip beside them. */
  partner?: boolean;
}) {
  const pathname = usePathname();
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
      {/* Which view you are in. The rail says it too, but the rail is a menu
          and this is the page — a title that does not name the page it titles
          is half a title. */}
      {viewLabel && (
        <p className="text-muted-foreground text-[13px]">{viewLabel}</p>
      )}
    </div>
  );
}
