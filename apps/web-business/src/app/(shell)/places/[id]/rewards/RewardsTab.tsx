"use client";

// Rewards — what a guest EARNS here: Visit Rewards, the strategy ladder that
// prices it, and the Partnership body it depends on.
//
// Its own view since MESITA-1841. It was one zone inside Capabilities, which
// made the place's single loudest product decision — how much a returning
// guest gets back — a scroll position rather than an address. Pato's drawing
// of 2026-09-14 gives it a row.
//
// Same component, other zone: the ladder is ONE computation (Partner unlocks
// Visit Rewards, Stripe unlocks the money rungs) with two displays, so nothing
// here re-derives what Capabilities already knows.
import { Suspense } from "react";
import { PromosSection } from "@/components/place-manage/sections/PromosSection";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

export function RewardsTab() {
  const { place, setPlace } = usePlaceContext();
  return (
    <Suspense fallback={null}>
      <PromosSection place={place} onSaved={setPlace} zone="rewards" />
    </Suspense>
  );
}
