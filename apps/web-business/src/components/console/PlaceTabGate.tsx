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
// A pathname that names no tab is not an error here: `/places/<id>` is a live
// address, a 307 onto Profile, and refusing it mid-forward would turn a
// redirect into a dead end.

import { notFound, usePathname } from "next/navigation";
import { placeTabFromPathname } from "@/lib/place-tabs";
import { usePlaceScope } from "@/app/(shell)/places/[id]/PlaceScope";

export function PlaceTabGate() {
  const pathname = usePathname();
  const { tabs } = usePlaceScope();
  const tab = placeTabFromPathname(pathname);
  if (tab !== null && !tabs.includes(tab)) notFound();
  return null;
}
