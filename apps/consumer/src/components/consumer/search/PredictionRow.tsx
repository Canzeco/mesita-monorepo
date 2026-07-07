"use client";

// One search-suggestion row, shared by the text-search results panel and
// the Ask AI chat's place cards so both surfaces run the exact same
// Info / Add-to-Mesita mechanics.
//
// The prediction comes from consumer-suggest-places (Google + Mesita
// merge). Rows already on Mesita get an Info button → place page; rows
// Google knows but Mesita doesn't get the Add button, which fires the
// real consumer-web-create-place flow. The place is created immediately;
// the row flips to a persistent "Being added" state while the Enricher
// enriches it asynchronously, so there's nothing further to wait on here.

import Image from "next/image";
import {
  BadgeCheck,
  Check,
  Globe,
  MapPin,
  Star,
  Store,
  Wand2,
} from "lucide-react";
import { Spinner } from "@/components/shared";
import type { Place } from "@/lib/api/places";
import type { PlacePrediction } from "@/lib/api/place-search";
import { resolvePlaceCategoryName } from "@/lib/place-category";
import { cn } from "@/lib/utils";
import { formatKm } from "./search-utils";

export type AddState = "adding" | "added";

export function PredictionRow({
  prediction,
  matchedPlace,
  addState,
  onInfo,
  onAdd,
  compact = false,
}: {
  prediction: PlacePrediction;
  /** Catalog row matched by name — lights up photo + rating/$ /km meta. */
  matchedPlace: Place | null;
  addState: AddState | undefined;
  onInfo: (prediction: PlacePrediction) => void;
  onAdd: (prediction: PlacePrediction) => void;
  /** Chat bubbles are narrower than the results panel. */
  compact?: boolean;
}) {
  const onMesita = prediction.status !== "not_in_mesita";
  const verified =
    prediction.status === "verified_partner_self" ||
    prediction.status === "verified_partner_other";
  const added = addState === "added";
  const adding = addState === "adding";
  const photo = matchedPlace?.photos[0];

  const category = matchedPlace
    ? resolvePlaceCategoryName({
        categoryLabel: matchedPlace.category_label,
        category: matchedPlace.category,
      })
    : null;
  const subtitle = added
    ? "Being added — we're building this place's profile; it'll appear on Mesita in a few minutes."
    : [category, matchedPlace?.zone].filter(Boolean).join(" · ") ||
      prediction.secondaryText;

  return (
    <div
      className={cn(
        "border-border bg-card flex items-center gap-3 rounded-xl border p-2 transition",
        added && "border-emerald-200 bg-emerald-50/70",
      )}
    >
      {/* Thumb: catalog photo when matched, tinted circle otherwise. */}
      <span
        className={cn(
          "relative shrink-0 overflow-hidden rounded-lg",
          compact ? "h-12 w-12" : "h-14 w-14",
        )}
      >
        {photo ? (
          <Image
            src={photo}
            alt={prediction.mainText}
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : onMesita ? (
          <span className="bg-pink-gradient absolute inset-0 flex items-center justify-center text-base font-bold text-white">
            {prediction.mainText[0]?.toUpperCase() ?? "·"}
          </span>
        ) : (
          <span className="bg-muted text-muted-foreground absolute inset-0 flex items-center justify-center">
            <MapPin className="h-5 w-5" />
          </span>
        )}
        {/* Source badge pinned on the thumb. */}
        <span
          className={cn(
            "absolute top-0.5 left-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold",
            added
              ? "bg-emerald-500 text-white"
              : onMesita
                ? "bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground border",
          )}
        >
          {added ? (
            <Check className="h-2.5 w-2.5" />
          ) : onMesita ? (
            <Check className="h-2.5 w-2.5" />
          ) : (
            <Globe className="h-2.5 w-2.5" />
          )}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className="truncate text-sm font-semibold">
            {prediction.mainText}
          </span>
          {verified && (
            <BadgeCheck
              className="text-primary h-3.5 w-3.5 shrink-0"
              aria-label="Verified Partner"
            />
          )}
        </span>
        <span
          className={cn(
            "block text-[11px] leading-snug",
            added ? "text-emerald-700" : "text-muted-foreground truncate",
          )}
        >
          {subtitle}
        </span>
        {!added && matchedPlace && (
          <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[10px]">
            {matchedPlace.google_rating != null && (
              <span className="flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                {matchedPlace.google_rating.toFixed(1)}
              </span>
            )}
            {matchedPlace.price_level != null && (
              <span>{"$".repeat(matchedPlace.price_level)}</span>
            )}
            {matchedPlace.distance_km != null && (
              <span>{formatKm(matchedPlace.distance_km)}</span>
            )}
          </span>
        )}
      </span>

      {added ? (
        // Still enriching — its profile page isn't built yet, so it must NOT
        // be openable. A non-interactive spinner pill replaces Info/Add until
        // the Enricher finishes and the row re-resolves to a normal on-Mesita
        // place on the next suggest refresh.
        <span className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700">
          <Spinner size="sm" className="border-emerald-300 border-t-emerald-600" />
          Enriching
        </span>
      ) : onMesita ? (
        <button
          type="button"
          onClick={() => onInfo(prediction)}
          className="bg-tier-gold flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-black/80 shadow-sm transition active:scale-95"
        >
          <Store className="h-3 w-3" /> Info
        </button>
      ) : (
        <button
          type="button"
          disabled={adding}
          onClick={() => onAdd(prediction)}
          className="bg-pink-gradient shadow-glow flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white transition active:scale-95 disabled:opacity-70"
        >
          {adding ? (
            <Spinner size="sm" className="border-white/40 border-t-white" />
          ) : (
            <Wand2 className="h-3 w-3" />
          )}
          {adding ? "Adding…" : "Add"}
        </button>
      )}
    </div>
  );
}
