"use client";

import { Tag } from "lucide-react";
import { isSectionSoon } from "../../nav";
import { PromosSection } from "../../sections/PromosSection";
import { usePlaceContext } from "../../PlaceContext";

// Per-place Promos — the membership ladder, the strategy cards and the v11
// rate grid.
//
// PARKED (Pato live 2026-08-20, "just soon"): the whole tab sits behind the
// Soon gate in `nav.ts`. The chrome renders the tab disabled and this route
// serves the placeholder below; the grid underneath is untouched, so flipping
// `soon: false` in nav.ts brings it all back.
export default function PlacePromosPage() {
  if (isSectionSoon("promos")) return <PromosSoon />;
  return <PromosGrid />;
}

function PromosSoon() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-10">
      <div className="border-border bg-card flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
        <span className="bg-muted/60 text-muted-foreground flex h-11 w-11 items-center justify-center rounded-full">
          <Tag className="h-5 w-5" />
        </span>
        <p className="font-display text-foreground text-lg font-semibold tracking-tight">
          Promos is coming soon
        </p>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          Partnership, strategy and the per-place reward grid are parked.
          Nothing is lost — the rates already saved stay exactly as they are.
        </p>
        <span className="bg-muted text-muted-foreground mt-1 rounded-full px-2 py-0.5 type-meta font-bold tracking-wider uppercase">
          Soon
        </span>
      </div>
    </div>
  );
}

/** The live grid — parked behind the Soon gate above, not deleted. */
function PromosGrid() {
  const { place, setPlace } = usePlaceContext();

  return (
    <div className="mx-auto max-w-6xl">
      <PromosSection place={place} onSaved={setPlace} />
    </div>
  );
}
