"use client";

// Not-on-Mesita preview — the place-page moment for a From-Google search
// row. Mirrors the place modal's header shape (name + address) but is
// honest that the profile doesn't exist yet: the body says so and carries
// the one real action, Add to Mesita (consumer-web-create-place → async
// Enricher). State-driven (LocalSheet), not a route modal, because there is
// no Mesita place id to route to.
//
// So the consumer knows exactly WHICH profile they're adding, the sheet
// hydrates itself from Google Places (New) directly on the client — hero
// photo, full formatted address, Google Maps link — using the same public
// NEXT_PUBLIC_GMP_KEY the map runs on. Pato-directed exception to the
// EF-only rule: this is Google's API, not our DB, nothing is persisted
// (display-only, session-cached in memory), and every field degrades
// gracefully if the key can't reach Places.

import { useEffect, useState } from "react";
import { ExternalLink, MapPinPlus, Wand2, X } from "lucide-react";
import { Spinner } from "@/components/shared";
import type { PlacePrediction } from "@/lib/api/place-search";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import type { AddState } from "./PredictionRow";

type GoogleProfile = {
  photoUrl?: string;
  formattedAddress?: string;
  googleMapsUri?: string;
};

// Session-scoped memo so reopening the same result never refetches.
// Front-only by design — nothing about the preview is saved on the back.
const profileCache = new Map<string, GoogleProfile>();

async function fetchGoogleProfile(
  placeId: string,
  apiKey: string,
): Promise<GoogleProfile> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}` +
      `?fields=photos,formattedAddress,googleMapsUri&key=${apiKey}`,
  );
  if (!res.ok) throw new Error(`places details ${res.status}`);
  const data = (await res.json()) as {
    photos?: Array<{ name: string }>;
    formattedAddress?: string;
    googleMapsUri?: string;
  };
  const photoName = data.photos?.[0]?.name;
  return {
    photoUrl: photoName
      ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&key=${apiKey}`
      : undefined,
    formattedAddress: data.formattedAddress,
    googleMapsUri: data.googleMapsUri,
  };
}

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

  // Cache is read during render; the state value only exists to re-render
  // once a miss resolves (the effect writes the cache before setting it).
  const [, setFetchedId] = useState<string | null>(null);
  const profile = prediction ? profileCache.get(prediction.placeId) : undefined;

  useEffect(() => {
    if (!open || !prediction || !apiKey) return;
    const id = prediction.placeId;
    if (profileCache.has(id)) return;
    let stale = false;
    (async () => {
      let fetched: GoogleProfile = {};
      try {
        fetched = await fetchGoogleProfile(id, apiKey);
      } catch {
        // Key can't reach Places (or network blip) — cache the empty
        // profile so we don't hammer, and let the fallbacks render.
      }
      profileCache.set(id, fetched);
      if (!stale) setFetchedId(id);
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

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Place preview">
      {prediction && (
        <div className="flex flex-col px-4 pt-3 pb-5">
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
              <MapPinPlus className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
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
                <ExternalLink className="h-3 w-3" />
              </a>
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

          {profile?.photoUrl && (
            // Google's own profile photo, display-only, so the consumer can
            // confirm this is the place they mean before adding it.
            // eslint-disable-next-line @next/next/no-img-element -- remote Google media URL (302s to googleusercontent), not a static asset for next/image
            <img
              src={profile.photoUrl}
              alt={`${prediction.mainText} — photo from Google`}
              className="mt-4 aspect-[5/2] w-full rounded-2xl object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}

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
