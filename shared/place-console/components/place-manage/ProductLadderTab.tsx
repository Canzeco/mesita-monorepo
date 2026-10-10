"use client";

// ONE VIEW BODY FOR ALL FIVE PRODUCT VIEWS (MESITA-1885).
//
// Visits · Orders · Reservations · Pay · Credits are five addresses over ONE
// engine: `PromosSection` computes the whole dependency ladder (Partner
// unlocks Visit Rewards and Mesita Pay; Stripe unlocks the money rungs) and
// renders the rows its `zone` owns. Five copies of this file, differing only
// in a string, is five places for that string to drift from `ZONE_ROWS`.
//
// It stays a CLIENT component because `usePlaceContext` is where the place
// and its setter live: a place view page reads nothing itself (the layout
// resolved the matrix once into `PlaceScope`), so the data is already here and
// a server round trip per product view would be pure cost.
import { Suspense } from "react";
import { PromosSection } from "@/components/place-manage/sections/PromosSection";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";
import type { LadderZone } from "@/components/place-manage/sections/controls/offerings";

export function ProductLadderTab({ zone }: { zone: LadderZone }) {
  const { place, setPlace } = usePlaceContext();
  return (
    <Suspense fallback={null}>
      <PromosSection place={place} onSaved={setPlace} zone={zone} />
    </Suspense>
  );
}
