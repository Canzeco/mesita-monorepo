"use client";

// Not-on-Mesita preview — the place-page moment for a From-Google search
// row. Mirrors the place modal's header shape (name + address) but is
// honest that the profile doesn't exist yet: the body says so and carries
// the one real action, Add to Mesita (consumer-web-create-place → ugly
// profile; guests vote to Enrich). State-driven (LocalSheet), not a route
// modal, because there is
// no Mesita place id to route to.
//
// So the consumer knows exactly WHICH profile they're adding, the sheet
// hydrates itself from Google Places (New) directly on the client — hero
// photo, full formatted address, Google Maps link — using the same public
// NEXT_PUBLIC_GMP_KEY the map runs on. Pato-directed exception to the
// EF-only rule: this is Google's API, not our DB, nothing is persisted
// (display-only, session-cached in memory), and every field degrades
// gracefully if the key can't reach Places. Details + one photo fire only
// when this sheet opens — map pins and the nearby 50 never pay that SKU.

import { useEffect, useState } from "react";
import { ExternalLink, MapPinPlus, Wand2, X } from "lucide-react";
import { Skeleton, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import type { PlacePrediction } from "@/lib/api/place-search";
import {
  fetchGooglePlacePreview,
  isDisplayablePlacePhoto,
  mergeGooglePlacePreview,
  settleGooglePlaceCache,
  type GooglePlacePreview,
} from "@/lib/google-place-preview";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import type { AddState } from "./add-state";

// Session-scoped memo so reopening the same result never refetches.
// Front-only by design — nothing about the preview is saved on the back.
const profileCache = new Map<string, GooglePlacePreview>();

export function GooglePlaceSheet({
  open,
  prediction,
  addState,
  apiKey,
  onAdd,
  onClose,
}: {
  open: boolean;
  /** Kept through the close so the exit transition doesn't blank the panel. */
  prediction: PlacePrediction | null;
  addState: AddState | undefined;
  /** Public Google key (NEXT_PUBLIC_GMP_KEY) — same one the map uses. */
  apiKey: string;
  onAdd: (prediction: PlacePrediction) => void;
  onClose: () => void;
}) {
  const adding = addState === "adding";
  const added = addState === "added";

  // Cache is the session memo. `hero` is the last settled fetch. Paint
  // merges both so a later photo in the cache is never stuck behind a
  // photo-less hero, and an empty refetch cannot wipe an address.
  const [fetchedId, setFetchedId] = useState<string | null>(null);
  const [hero, setHero] = useState<GooglePlacePreview | undefined>(undefined);
  const [photoFailed, setPhotoFailed] = useState(false);
  const cached = prediction ? profileCache.get(prediction.placeId) : undefined;
  const profile = mergeGooglePlacePreview(
    fetchedId === prediction?.placeId ? hero : undefined,
    cached,
  );
  const waiting = Boolean(
    open &&
      prediction &&
      apiKey &&
      !isDisplayablePlacePhoto(profile.photoUrl) &&
      fetchedId !== prediction.placeId,
  );

  useEffect(() => {
    if (!open || !prediction || !apiKey) return;
    const id = prediction.placeId;
    if (isDisplayablePlacePhoto(profileCache.get(id)?.photoUrl)) return;
    let stale = false;
    (async () => {
      let fetched: GooglePlacePreview | null = null;
      try {
        fetched = await fetchGooglePlacePreview(id, apiKey);
      } catch {
        fetched = null;
      }
      const next = settleGooglePlaceCache(profileCache, id, fetched);
      if (!stale) {
        setPhotoFailed(false);
        setHero(next);
        setFetchedId(id);
      }
    })();
    return () => {
      stale = true;
    };
  }, [open, prediction, apiKey]);

  const address =
    profile?.formattedAddress ?? prediction?.secondaryText ?? null;
  // Maps URL needs no API at all — constructed from the place id — so the
  // link renders even when the details fetch is unavailable.
  const mapsHref = prediction
    ? (profile?.googleMapsUri ??
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        prediction.mainText,
      )}&query_place_id=${encodeURIComponent(prediction.placeId)}`)
    : "#";
  const cachedPhoto = profile?.photoUrl;
  const photoUrl =
    isDisplayablePlacePhoto(cachedPhoto) && !photoFailed ? cachedPhoto : null;

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Place preview">
      {prediction && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="bg-muted relative h-44 w-full shrink-0 overflow-hidden">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Google Places photo URI (or a 302 media URL), not a static asset for next/image
              <img
                src={photoUrl}
                alt={`${prediction.mainText} — photo from Google`}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
                onError={() => setPhotoFailed(true)}
              />
            ) : waiting ? (
              <Skeleton className="h-full w-full rounded-none" />
            ) : (
              <div className="bg-primary/10 text-primary flex h-full w-full items-center justify-center">
                <MapPinPlus className="h-10 w-10" aria-hidden />
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/55"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-3 pb-5">
            <div className="min-w-0">
              <p className="font-display text-lg leading-tight font-semibold">
                {prediction.mainText}
              </p>
              {address && (
                <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                  {address}
                </p>
              )}
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-1.5 inline-flex items-center gap-1 text-xs font-semibold"
              >
                View on Google Maps
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </div>

            <div className="bg-muted/60 mt-4 rounded-2xl px-4 py-3">
              <p className="text-sm font-semibold">
                This place isn&apos;t on Mesita yet.
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Google knows it. Add it to Mesita to open the profile. Enrich
                waits until enough guests vote.
              </p>
            </div>

            {added ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                <p className="text-xs leading-relaxed font-medium text-emerald-700">
                  On Mesita. Open the profile and vote to enrich it.
                </p>
              </div>
            ) : (
              <Button
                type="button"
                size="lg"
                disabled={adding}
                onClick={() => onAdd(prediction)}
                className="shadow-glow mt-4 w-full gap-1.5 text-sm font-semibold disabled:opacity-70"
              >
                {adding ? (
                  <Spinner size="sm" className="border-white/40 border-t-white" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                {adding ? "Adding…" : "Add to Mesita"}
              </Button>
            )}
          </div>
        </div>
      )}
    </LocalSheet>
  );
}
