"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Navigation } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { PromoChip } from "@/components/consumer/PromoChip";
import { getOpeningStatusLabel } from "@/lib/place-status";
import { placeHref } from "@/lib/place-route";
import { firstInitial } from "@/lib/utils";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";

// Confirm before unsaving — one tap opens this, a second (Yes) actually
// removes. `place` null-gates the open state so the exit transition still runs.
export function RemoveConfirmDialog({
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

export function FavoriteRow({
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
