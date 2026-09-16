"use client";

// A URL IS NOT A CAPABILITY — checked once, in the layout (MESITA-1875).
//
// The rule is unchanged and so is its source: `tabsForAccess` in
// lib/place-tabs is the ONE matrix, the rail applies it to decide which rows
// to draw, and a viewer who TYPES an address the rail withheld must be refused
// too. What changed is where the refusal happens.
//
// It used to live on each view page, and cost an Edge Function round trip per
// navigation to re-learn a fact the layout had just computed (see
// PlaceScope.tsx). The layout publishes the matrix's answer now, so the gate
// is one `usePathname()` read against a list already in memory.
//
// `notFound()` from a client component renders the nearest boundary exactly as
// it does from a server one — `places/[id]/not-found.tsx`, which sits INSIDE
// the segment so the place's heading and the rail's place section survive the
// 404 (its own docblock explains why that matters).
//
// A pathname that names no tab and no page is not an error here:
// `/places/<id>` is a live address, a 307 onto Profile, and refusing it
// mid-forward would turn a redirect into a dead end.
//
// ── IT GATES THE PAGES TOO (MESITA-1892) ──────────────────────────────────
//
// Settings, Products, Customers and Activity hung off `/orgs/<id>/…` and were
// refused by a membership layout of their own; they are segments under the
// place now, and `tabsForAccess` has nothing to say about them — they are not
// tabs, so `placeTabFromPathname` answers null and the rule above lets them
// through. They still must not open for a place the caller holds no
// membership on: they are the HOLDER's pages, the rail already hides their
// rows for a pool place, and Settings would otherwise throw inside
// `usePlaceContext`, which a pool place has no provider for.
//
// `held` is the same flag the layout computed for the matrix (`manage !== null`),
// so one read gates both spaces. A place that does not exist and a place the
// caller does not hold both answer 404, which is what keeps the path from
// being an oracle.

import { notFound, usePathname } from "next/navigation";
import { placeTabFromPathname } from "@/lib/place-tabs";
import {
  isPlaceTerminalPathname,
  placePageFromPathname,
} from "@/lib/console-routes";
import { usePlaceScope } from "@/app/(shell)/places/[id]/PlaceScope";

export function PlaceTabGate() {
  const pathname = usePathname();
  const { tabs, held } = usePlaceScope();
  const tab = placeTabFromPathname(pathname);
  if (tab !== null && !tabs.includes(tab)) notFound();
  const isPage =
    placePageFromPathname(pathname) !== null ||
    isPlaceTerminalPathname(pathname);
  if (isPage && !held) notFound();
  return null;
}
