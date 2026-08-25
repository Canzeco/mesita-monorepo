"use client";

import { Handshake } from "lucide-react";
import { isSectionSoon } from "../../nav";
import { PromosSection } from "../../sections/PromosSection";
import { usePlaceContext } from "../../PlaceContext";

// Per-place Partner tab — membership, strategy cards. Route stays /promos.
export default function PlacePromosPage() {
  if (isSectionSoon("promos")) return <PromosSoon />;
  return <PromosGrid />;
}

function PromosSoon() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-10">
      <div className="border-border bg-card flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
        <span className="bg-muted/60 text-muted-foreground flex h-11 w-11 items-center justify-center rounded-full">
          <Handshake className="h-5 w-5" />
        </span>
        <p className="font-display text-foreground text-lg font-semibold tracking-tight">
          Partner is coming soon
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

/** Live visit-promo editor. */
function PromosGrid() {
  const { place, setPlace } = usePlaceContext();

  return (
    <div className="mx-auto max-w-6xl">
      <PromosSection place={place} onSaved={setPlace} />
    </div>
  );
}
