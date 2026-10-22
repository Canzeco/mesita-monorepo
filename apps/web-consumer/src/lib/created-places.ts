"use client";

// A Google-only card the guest opened, saved or shared is a Mesita place once
// get-or-create lands (MESITA-2307, MESITA-2663). From then on every list
// that drew its Google card draws the Mesita card instead (Pato, MESITA-2683:
// "the profile has been created but i still have the old not created
// profile data in the carousel"): Home's catalog and Search's carousel read
// this store and swap the card where it stands, so the list keeps its order,
// its score and its distance, and the guest's selection stays on it.
//
// One get-place read per created place, kept for the life of the tab like
// the pools it corrects (lib/area-pool-cache.ts). No list reloads for it, so
// a create spends no Google call; the next real load brings the server's
// own card.

import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiFetchPlaceCard, type Place } from "@/lib/api/places";
import { isGoogleOnlyPlace } from "@/lib/place-placeholder";

/** Created places' Mesita cards, by Google Place ID. */
export type CreatedPlaces = ReadonlyMap<string, Place>;

let created: CreatedPlaces = new Map();
const loading = new Set<string>();
const listeners = new Set<() => void>();

/** Read the created place's card once and hand it to every list. */
export function rememberCreatedPlace(
  supabase: SupabaseClient,
  gid: string,
  id: string,
): void {
  if (created.has(gid) || loading.has(gid)) return;
  loading.add(gid);
  void apiFetchPlaceCard(supabase, id)
    .then((card) => {
      if (!card) return;
      created = new Map(created).set(gid, card);
      for (const notify of listeners) notify();
    })
    .finally(() => loading.delete(gid));
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

const NONE: CreatedPlaces = new Map();

/** The places created so far; a list redraws when one lands. */
export function useCreatedPlaces(): CreatedPlaces {
  return useSyncExternalStore(
    subscribe,
    () => created,
    () => NONE,
  );
}

/** The Google Place ID a Google-only card stands for; null for a Mesita card. */
function stubGid(place: Place): string | null {
  if (!isGoogleOnlyPlace(place)) return null;
  const gid =
    place.google_place_id ||
    place.slug ||
    (place.id.startsWith("g:") ? place.id.slice(2) : "");
  return gid || null;
}

/** Each Google card Mesita has since created becomes its Mesita card, where
 *  it stood: the list's own Area facts, map score and distance ride along.
 *  A place already in the list is never drawn twice. */
export function withCreatedPlaces(
  places: Place[],
  made: CreatedPlaces,
): Place[] {
  if (made.size === 0) return places;
  let swapped = false;
  const next = places.map((place) => {
    const gid = stubGid(place);
    const card = gid ? made.get(gid) : undefined;
    if (!card) return place;
    swapped = true;
    return {
      ...card,
      area: place.area ? { ...place.area, source: "mesita" as const } : card.area,
      score: place.score ?? card.score,
      distance_km: place.distance_km ?? card.distance_km ?? null,
    };
  });
  if (!swapped) return places;
  const seen = new Set<string>();
  return next.filter((place) => {
    if (seen.has(place.id)) return false;
    seen.add(place.id);
    return true;
  });
}

/** A selection made on a Google card follows it onto its Mesita card. */
export function createdPlaceId(
  id: string | null,
  made: CreatedPlaces,
): string | null {
  if (!id?.startsWith("g:")) return id;
  return made.get(id.slice(2))?.id ?? id;
}
