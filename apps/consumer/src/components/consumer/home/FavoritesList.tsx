"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Navigation } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { enrichPlaceOverview } from "@/lib/mock/enrich-overview";
import { readSavedPlacePreviews, useSavedPlaces } from "@/lib/saved-places";
import { placeHref } from "@/lib/place-route";
import { firstInitial } from "@/lib/utils";

// Favorites mode — everything saved tonight. Reads the same live
// saved-places store the SwipeDeck save action writes, so a right-swipe in
// Swipe mode shows up here the moment the consumer flips tabs. Place rows
// resolve against the stored previews first (they carry the enriched card
// the consumer actually saved) and fall back to the server deck.

export function FavoritesList({ deckPlaces }: { deckPlaces: Place[] }) {
  const { savedIds } = useSavedPlaces();
  // Previews re-read on every mount — the component remounts on each mode
  // switch, so saves made moments ago in Swipe mode are always picked up.
  const [previewCatalog] = useState<Map<string, Place>>(() =>
    readSavedPlacePreviews<Place>(),
  );

  const catalog = useMemo(() => {
    const merged = new Map<string, Place>();
    for (const [id, place] of previewCatalog) merged.set(id, place);
    for (const place of deckPlaces) merged.set(place.id, place);
    return merged;
  }, [deckPlaces, previewCatalog]);

  const places = useMemo<Place[]>(
    () =>
      [...savedIds]
        .map((id) => catalog.get(id))
        .filter((v): v is Place => v != null)
        .map((v) => enrichPlaceOverview(v)),
    [savedIds, catalog],
  );

  return (
    <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
      <div className="px-4 pt-4 pb-6">
        {places.length === 0 ? (
          <div className="border-border bg-card/60 mt-6 flex flex-col items-center rounded-3xl border border-dashed p-8 text-center">
            <div className="bg-primary/10 flex h-14 w-14 items-center justify-center rounded-2xl">
              <Heart className="text-primary h-7 w-7" />
            </div>
            <h3 className="font-display mt-3 text-lg font-semibold tracking-tight">
              No saves yet
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Swipe right on a place to save it for later.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Saved tonight
              </p>
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-bold">
                {places.length}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {places.map((place) => (
                <FavoriteRow key={place.id} place={place} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FavoriteRow({ place }: { place: Place }) {
  const photo = place.photos[0];
  // distance_km === 0 is the SwipeDeck's "couldn't calculate" placeholder —
  // treat it as unknown here so the row never claims a fake 0 km.
  const distanceLabel =
    place.distance_km != null && place.distance_km > 0
      ? `${place.distance_km} km`
      : null;
  const subtitle = [place.zone, distanceLabel].filter(Boolean).join(" · ");

  return (
    <Link
      href={placeHref(place.slug || place.id, "explore")}
      className="border-border bg-card flex w-full items-center gap-3 rounded-2xl border p-3 transition hover:shadow-md active:scale-[0.99]"
    >
      <div className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
        {photo ? (
          <Image
            src={photo}
            alt={place.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <div className="bg-pink-gradient absolute inset-0 flex items-center justify-center text-white/85">
            <span className="font-display text-xl font-bold tracking-tight">
              {firstInitial(place.name)}
            </span>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-display text-foreground truncate text-[15px] font-semibold tracking-tight">
          {place.name}
        </p>
        {subtitle && (
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
            <Navigation className="h-3 w-3 shrink-0" />
            <span className="truncate">{subtitle}</span>
          </p>
        )}
      </div>

      <div className="bg-rose-500/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
        <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
      </div>
    </Link>
  );
}
