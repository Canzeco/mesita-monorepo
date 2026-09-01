"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Heart } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { enrichPlaceOverview } from "@/lib/mock/enrich-overview";
import {
  readSavedPlacePreviews,
  removeSavedPlacePreview,
  upsertSavedPlacePreview,
  useSavedPlaces,
} from "@/lib/saved-places";
import { toast } from "@/lib/toast";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { EmptyState, Skeleton } from "@/components/shared";
import { FavoriteTile } from "./FavoriteTile";
import { RemoveConfirmDialog } from "./RemoveConfirmDialog";

// Favorites mode — everything the consumer has saved. Reads the same live
// saved-places store the SwipeDeck save action writes, so a right-swipe in
// Swipe mode shows up here the moment the consumer flips tabs. Place rows
// resolve against the fresh server deck first (deck wins — it's live data)
// and fall back to the stored previews for saves outside tonight's deck.
//
// Layout: a two-column photo grid of saved places only — count header plus
// filled-heart tiles. This tab is the bookmark list, not a second discovery
// surface: no similar-places rail.

/** Saves past this count earn a sort control; below it, it's chrome. */
const SORT_CONTROL_MIN = 4;

type Sort = "recent" | "open";

export function FavoritesList({
  deckPlaces,
  deckError = null,
}: {
  deckPlaces: Place[];
  /** The shared deck fetch failed. Saves still resolve from previews. */
  deckError?: string | null;
}) {
  const { savedIds, hydrated, setSaved } = useSavedPlaces();
  // Removing a save is a two-step: the heart opens a confirm dialog first, so
  // a single stray tap can't wipe a save. `pendingRemove` holds the place the
  // dialog is asking about (null = closed).
  const [pendingRemove, setPendingRemove] = useState<Place | null>(null);
  const [sort, setSort] = useState<Sort>("recent");

  // The actual unsave, run only after the user confirms. Keeps the Undo toast
  // as a second safety net (restores both the saved id and the preview
  // snapshot so the tile comes back even if the place isn't in tonight's deck).
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

  // Newest first. The store appends on save, so insertion order is
  // oldest-first — reversing it puts the save you just made in the hero slot,
  // which is where you look for it.
  const places = useMemo<Place[]>(
    () =>
      [...savedIds]
        .reverse()
        .map((id) => catalog.get(id))
        .filter((v): v is Place => v != null)
        .map((v) => enrichPlaceOverview(v)),
    [savedIds, catalog],
  );

  // Saved ids that resolved to neither the deck nor a preview. These used to
  // vanish silently — you saved three places and the screen showed two with no
  // explanation. Counting them lets the UI say so.
  const unresolved = Math.max(0, savedIds.size - places.length);
  const openNow = places.filter((p) => p.open_now === true).length;

  const ordered = useMemo(() => {
    if (sort === "recent") return places;
    // Open first, each group keeping its recency order (Array.sort is stable).
    return [...places].sort(
      (a, b) => Number(b.open_now === true) - Number(a.open_now === true),
    );
  }, [places, sort]);

  return (
    <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* savedIds is an empty set until localStorage is read (SSR parity), so
          branching on length before `hydrated` flashes "nothing saved" at
          everyone who has saves. */}
      {!hydrated ? (
        <SavedGridSkeleton />
      ) : savedIds.size === 0 ? (
        // Gate the zero state on what was SAVED, not on what resolved. A
        // consumer with three saves and a failed deck resolves to zero places —
        // telling them "nothing saved yet" would be the silent drop wearing a
        // different hat. With saves on record we fall through and the notice
        // below explains the gap.
        <EmptyState
          icon={Heart}
          title="Nothing saved yet"
          description="Swipe right on a place and it lands here — with its discount attached."
          action={{
            label: "Start swiping",
            href: CONSUMER_ROUTES.search,
          }}
        />
      ) : (
        <div className="px-4 pt-4 pb-6">
          <div className="mb-3 flex items-center justify-between gap-2 px-1">
            <p
              className="text-muted-foreground text-xs font-semibold"
              aria-live="polite"
            >
              <span className="text-foreground">{savedIds.size} saved</span>
              {openNow > 0 && ` · ${openNow} open now`}
            </p>
            {places.length >= SORT_CONTROL_MIN && (
              <button
                type="button"
                onClick={() =>
                  setSort((s) => (s === "recent" ? "open" : "recent"))
                }
                aria-pressed={sort === "open"}
                aria-label={
                  sort === "recent"
                    ? "Sort by recently saved"
                    : "Sort open places first"
                }
                className="border-border bg-card text-muted-foreground hover:text-foreground type-label flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 font-semibold transition"
              >
                <ArrowUpDown className="h-3 w-3" />
                {sort === "recent" ? "Recent" : "Open first"}
              </button>
            )}
          </div>

          {(unresolved > 0 || deckError) && (
            <p className="bg-muted text-muted-foreground mb-3 rounded-lg px-3 py-2 text-xs leading-snug">
              {unresolved > 0
                ? `${unresolved} saved ${unresolved === 1 ? "place" : "places"} couldn't be loaded right now.`
                : "Tonight's picks didn't load, so this is showing your saved copies."}
            </p>
          )}

          <ul
            role="list"
            aria-label="Saved places"
            className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2"
          >
            {ordered.map((place) => (
              <FavoriteTile
                key={place.id}
                place={place}
                saved
                onToggle={() => setPendingRemove(place)}
              />
            ))}
          </ul>
        </div>
      )}

      <RemoveConfirmDialog
        place={pendingRemove}
        onCancel={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

// Matches the grid's shape (one wide tile + two square) so the screen arrives
// rather than blinking through a blank frame.
function SavedGridSkeleton() {
  return (
    <div className="px-4 pt-4 pb-6">
      <Skeleton className="mb-3 ml-1 h-3.5 w-24" />
      <div className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2">
        <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
        <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
        <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
        <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
      </div>
    </div>
  );
}
