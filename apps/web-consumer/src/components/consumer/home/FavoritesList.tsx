"use client";

import { useMemo, useState } from "react";
import { Heart } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { enrichPlaceOverview } from "@/lib/mock/enrich-overview";
import {
  readSavedPlacePreviews,
  removeSavedPlacePreview,
  upsertSavedPlacePreview,
  useSavedPlaces,
} from "@/lib/saved-places";
import { toast } from "@/lib/toast";
import { FavoriteRow, RemoveConfirmDialog } from "./FavoriteRow";

// Favorites mode — everything the consumer has saved. Reads the same live
// saved-places store the SwipeDeck save action writes, so a right-swipe in
// Swipe mode shows up here the moment the consumer flips tabs. Place rows
// resolve against the fresh server deck first (deck wins — it's live data)
// and fall back to the stored previews for saves outside tonight's deck.

export function FavoritesList({ deckPlaces }: { deckPlaces: Place[] }) {
  const { savedIds, setSaved } = useSavedPlaces();
  // Removing a save is a two-step: the heart opens a confirm dialog first, so
  // a single stray tap can't wipe a save. `pendingRemove` holds the place the
  // dialog is asking about (null = closed).
  const [pendingRemove, setPendingRemove] = useState<Place | null>(null);

  // The actual unsave, run only after the user confirms. Keeps the Undo toast
  // as a second safety net (restores both the saved id and the preview
  // snapshot so the row comes back even if the place isn't in tonight's deck).
  const confirmRemove = (place: Place) => {
    setSaved(place.id, false);
    removeSavedPlacePreview(place.id);
    setPendingRemove(null);
    toast.action("Removed from saved", {
      label: "Undo",
      onClick: () => {
        upsertSavedPlacePreview(place);
        setSaved(place.id, true);
      },
    });
  };
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
                Saved
              </p>
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-bold">
                {places.length}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {places.map((place) => (
                <FavoriteRow
                  key={place.id}
                  place={place}
                  onRemove={() => setPendingRemove(place)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <RemoveConfirmDialog
        place={pendingRemove}
        onCancel={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
