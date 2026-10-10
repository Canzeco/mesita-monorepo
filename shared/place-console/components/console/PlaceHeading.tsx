"use client";

// The place screen's title (MESITA-1714). Replaces PlaceBar.
//
// PlaceBar was a second sticky chrome row carrying the place's name, its state
// badge and the view tabs. Once the rail carries the name AND the views, that
// bar restated both — 48px of permanent chrome, on the tallest screen in the
// console, saying what the column beside it already said. Deleted. (The
// MESITA-1804 pill row lived here for a day while the rail carried nothing;
// it left with MESITA-1807, for the same reason PlaceBar did.)
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
//
// The Partner chip is the shared `PartnerPill` (MESITA-1867). It was an
// inline span here with its own violet while the organization's page grew a
// second Partner chip of its own — one word, two colours, two pages. There is
// one subscription and one place to wear it now (MESITA-1892), and it wears
// the same component the catalogue's banner does.
//
// IT NAMES THE PAGE AS WELL AS THE VIEW (MESITA-1892). Every address under
// `places/[id]` renders beneath this heading, and four of them are PAGES
// rather than views — Settings, Products, Customers, Activity, which used to
// hang off the organization and had an `h1` each. They do not any more: a page
// body that added its own title would make this the second heading on the
// screen, so the sub-line answers for both spaces and each page body opens
// with its lead sentence.

import { usePathname } from "next/navigation";
import { PartnerPill, PlaceStateBadge } from "@/components/console/badges";
import { PLACE_TAB_LABEL, placeTabFromPathname } from "@/lib/place-tabs";
import {
  PLACE_PAGE_LABEL,
  placePageFromPathname,
} from "@/lib/console-routes";

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
  const page = placePageFromPathname(pathname);
  // EVERY PLACE ADDRESS NAMES ITSELF AGAIN (MESITA-1900). `products/terminal`
  // was the one that could not: `placePageFromPathname` answers "products" for
  // `products/pay` (the sub-step reads as its page) and answered null for
  // Terminal, so the heading had to special-case it. Terminal is gone and the
  // special case with it.
  const viewLabel = tab
    ? PLACE_TAB_LABEL[tab]
    : page
      ? PLACE_PAGE_LABEL[page]
      : null;

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
        {partner ? <PartnerPill /> : null}
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
