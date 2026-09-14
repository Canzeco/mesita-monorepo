"use client";

// Capabilities — what a guest CAN do here: Mesita Pay · Accept Prepays ·
// Sell Prepays · Pickup · Delivery · Reservations, plus the internal
// "How this place is run" box.
//
// The name came back in MESITA-1841. MESITA-1815 renamed this view Settings,
// label and segment together; Pato's 2026-09-14 drawing says Capabilities, and
// the word was always the domain's anyway (Notion Main §11.2,
// `state-vocabulary.ts`) — only the page had drifted off it.
//
// WHAT A GUEST EARNS LEFT. Visit Rewards, the strategy ladder and the
// Partnership body are Rewards' now, one view along. Same component, other
// zone: the ladder is one computation with two displays (PromosSection).
import { Suspense } from "react";
import { PromosSection } from "@/components/place-manage/sections/PromosSection";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

export function CapabilitiesTab() {
  const { place, setPlace } = usePlaceContext();
  return (
    <Suspense fallback={null}>
      <PromosSection place={place} onSaved={setPlace} zone="capabilities" />
    </Suspense>
  );
}
