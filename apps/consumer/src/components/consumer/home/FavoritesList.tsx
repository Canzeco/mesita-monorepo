"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Navigation } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { PromoChip } from "@/components/consumer/PromoChip";
import { getOpeningStatusLabel } from "@/lib/place-status";
import { enrichPlaceOverview } from "@/lib/mock/enrich-overview";
import {
  readSavedPlacePreviews,
  removeSavedPlacePreview,
  upsertSavedPlacePreview,
  useSavedPlaces,
} from "@/lib/saved-places";
import { placeHref } from "@/lib/place-route";
import { toast } from "@/lib/toast";
import { firstInitial } from "@/lib/utils";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";

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

// Confirm before unsaving — one tap opens this, a second (Yes) actually
// removes. `place` null-gates the open state so the exit transition still runs.
function RemoveConfirmDialog({
  place,
  onCancel,
  onConfirm,
}: {
  place: Place | null;
  onCancel: () => void;
  onConfirm: (place: Place) => void;
}) {
  // Hold the last place through the close so the panel doesn't blank mid-exit.
  const [shown, setShown] = useState<Place | null>(place);
  if (place && place !== shown) setShown(place);

  return (
    <LocalDialog
      open={place != null}
      onClose={onCancel}
      ariaLabel="Remove from saved"
    >
      <div className="flex flex-col p-5">
        <div className="bg-rose-500/10 flex h-12 w-12 items-center justify-center rounded-2xl">
          <Heart className="h-6 w-6 fill-rose-500 text-rose-500" />
        </div>
        <h3 className="font-display mt-3 text-lg font-semibold tracking-tight">
          Remove from saved?
        </h3>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {shown?.name
            ? `“${shown.name}” will be removed from your saved places.`
            : "This place will be removed from your saved places."}
        </p>
        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="border-border bg-card hover:bg-muted flex-1 rounded-xl border py-3 text-sm font-semibold transition active:scale-[0.98]"
          >
            No
          </button>
          <button
            type="button"
            onClick={() => shown && onConfirm(shown)}
            className="flex-1 rounded-xl bg-rose-500 py-3 text-sm font-semibold text-white transition hover:bg-rose-600 active:scale-[0.98]"
          >
            Yes, remove
          </button>
        </div>
      </div>
    </LocalDialog>
  );
}

function FavoriteRow({
  place,
  onRemove,
}: {
  place: Place;
  onRemove: () => void;
}) {
  const photo = place.photos[0];
  // distance_km === 0 is the SwipeDeck's "couldn't calculate" placeholder —
  // treat it as unknown here so the row never claims a fake 0 km.
  const distanceLabel =
    place.distance_km != null && place.distance_km > 0
      ? `${place.distance_km} km`
      : null;
  const subtitle = [place.zone, distanceLabel].filter(Boolean).join(" · ");
  const openingLabel = getOpeningStatusLabel(place);
  const isOpen = place.open_now === true;

  return (
    <div className="border-border bg-card flex w-full items-center gap-3 rounded-2xl border p-3 transition hover:shadow-md">
      {/* Photo + text navigate to the place; the heart is a separate control
          (interactive elements can't nest inside an <a>). */}
      <Link
        href={placeHref(place.slug || place.id)}
        className="flex min-w-0 flex-1 items-center gap-3 transition active:scale-[0.99]"
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
          {/* Opening status + reward summary. Each child self-hides when the
              row lacks data (no hours table, or a place with no reward), so an
              info-less row just shows its name + location. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 empty:mt-0">
            {openingLabel && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    isOpen ? "bg-emerald-500" : "bg-muted-foreground/40"
                  }`}
                />
                <span className={isOpen ? "text-emerald-600" : "text-muted-foreground"}>
                  {openingLabel}
                </span>
              </span>
            )}
            <PromoChip place={place} size="sm" />
          </div>
        </div>
      </Link>

      {/* Tap the filled heart to unsave (with an Undo toast). */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${place.name} from saved`}
        className="bg-rose-500/10 hover:bg-rose-500/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition active:scale-90"
      >
        <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
      </button>
    </div>
  );
}
