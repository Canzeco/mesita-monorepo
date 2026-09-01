"use client";

import { SlidersHorizontal } from "lucide-react";
import { isSectionSoon } from "../../nav";
import { PromosSection } from "../../sections/PromosSection";
import { usePlaceContext } from "../../PlaceContext";

// Per-place Controls tab — everything the place is SET to: the subscription,
// Visit Rewards, the three rails, and Team. Partnership and Settings merged
// here (Pato live 2026-09-01); the route stays /promos, because a rename
// never reaches the URL. /settings redirects in via [...slug].
export default function PlaceControlsPage() {
  if (isSectionSoon("promos")) return <ControlsSoon />;
  return <ControlsGrid />;
}

function ControlsSoon() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-10">
      <div className="border-border bg-card flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
        <span className="bg-muted/60 text-muted-foreground flex h-11 w-11 items-center justify-center rounded-full">
          <SlidersHorizontal className="h-5 w-5" />
        </span>
        <p className="font-display text-foreground text-lg font-semibold tracking-tight">
          Controls is coming soon
        </p>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          Partnership, strategy, the rails and Team are parked. Nothing is
          lost — everything already saved stays exactly as it is.
        </p>
        <span className="bg-muted text-muted-foreground mt-1 rounded-full px-2 py-0.5 type-meta font-bold tracking-wider uppercase">
          Soon
        </span>
      </div>
    </div>
  );
}

/** Live controls — offerings, rails and people. */
function ControlsGrid() {
  const { place, setPlace } = usePlaceContext();

  return (
    <div className="mx-auto max-w-6xl">
      <PromosSection place={place} onSaved={setPlace} />
    </div>
  );
}
