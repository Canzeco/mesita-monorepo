"use client";

// Not-on-Mesita preview — the place-page moment for a From-Google search
// row. Mirrors the place modal's header shape (name + locality) but is
// honest that the profile doesn't exist yet: the body says so and carries
// the one real action, Add to Mesita (consumer-web-create-place → async
// Enricher). State-driven (LocalSheet), not a route modal, because there is
// no Mesita place id to route to.

import { MapPin, Wand2, X } from "lucide-react";
import { Spinner } from "@/components/shared";
import type { PlacePrediction } from "@/lib/api/place-search";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import type { AddState } from "./PredictionRow";

export function GooglePlaceSheet({
  open,
  prediction,
  addState,
  onAdd,
  onClose,
}: {
  open: boolean;
  /** Kept through the close so the exit transition doesn't blank the panel. */
  prediction: PlacePrediction | null;
  addState: AddState | undefined;
  onAdd: (prediction: PlacePrediction) => void;
  onClose: () => void;
}) {
  const adding = addState === "adding";
  const added = addState === "added";

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Place preview">
      {prediction && (
        <div className="flex flex-col px-4 pt-3 pb-5">
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
              <MapPin className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg leading-tight font-semibold">
                {prediction.mainText}
              </p>
              {prediction.secondaryText && (
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {prediction.secondaryText}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="bg-muted/60 mt-4 rounded-2xl px-4 py-3">
            <p className="text-sm font-semibold">
              This place isn&apos;t on Mesita yet.
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Google knows it, but its Mesita profile hasn&apos;t been built.
              Add it and we&apos;ll create the full page — photos, ratings, and
              details — for everyone.
            </p>
          </div>

          {added ? (
            <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
              <Spinner
                size="sm"
                className="border-emerald-300 border-t-emerald-600"
              />
              <p className="text-xs leading-relaxed font-medium text-emerald-700">
                Being added — we&apos;re building this place&apos;s profile;
                it&apos;ll appear on Mesita in a few minutes.
              </p>
            </div>
          ) : (
            <button
              type="button"
              disabled={adding}
              onClick={() => onAdd(prediction)}
              className="bg-pink-gradient shadow-glow mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-70"
            >
              {adding ? (
                <Spinner size="sm" className="border-white/40 border-t-white" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {adding ? "Adding…" : "Add to Mesita"}
            </button>
          )}
        </div>
      )}
    </LocalSheet>
  );
}
