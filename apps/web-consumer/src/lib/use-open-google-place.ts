"use client";

// Opening a Google-only result's full profile (MESITA-2298). This is the ONE
// consumer action that creates a Mesita Place: consumer-web-create-place is
// get-or-create on the Google Place ID, so a held id opens its row and a new
// id creates the ugly profile, then the profile route opens. Nothing here
// runs on render, on a pin tap, on scroll or on a prefetch; a card calls it
// from a deliberate tap only.
//
// The tap navigates AT ONCE to the opening screen (MESITA-2311): the guest
// sees the place's name and a spinner while get-or-create runs there, instead
// of waiting on the card they tapped. `getOrCreateGooglePlace` is that
// screen's one call; it shares one request per Google Place ID, so a remount
// (React's dev double effect, a fast re-tap) never creates twice.
//
// The card the guest tapped rides along (MESITA-2307): it is stashed here and
// the opening screen draws it as the profile's first draft — name, category,
// stars, address, distance — with Google's photo, while the create runs.
//
// Every create passes through `getOrCreateGooglePlace` (the opening screen,
// a card's Save and Share), so this is where the lists learn of it: the
// created place's card goes to lib/created-places.ts, and Home's catalog and
// Search's carousel draw it where the Google card stood (MESITA-2683).

import { useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiCreateProject } from "@/lib/api/place-search";
import { rememberCreatedPlace } from "@/lib/created-places";
import { placeHref } from "@/lib/place-route";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { type PendingPlaceCard, stashPendingPlace } from "@/lib/pending-place";
import { useOpenPlaceHref } from "@/lib/use-open-place-href";

export type GoogleOnlyPlace = PendingPlaceCard & {
  slug?: string | null;
  google_place_id?: string | null;
};

/** The Google Place ID a Google-only row carries: the id, else the slug. */
export function googlePlaceIdOf(place: GoogleOnlyPlace): string | null {
  const gid = place.google_place_id ?? place.slug;
  return gid && gid.trim() ? gid : null;
}

/** The opening screen for a Google Place ID; the name rides along for the header. */
export function googleOpenHref(gid: string, name: string): string {
  const q = name.trim() ? `?name=${encodeURIComponent(name.trim())}` : "";
  return `${CONSUMER_ROUTES.place.prefix}open/${encodeURIComponent(gid)}${q}`;
}

export function useOpenGooglePlace(): (place: GoogleOnlyPlace) => void {
  // A stuck push never swallows the tap (MESITA-2816).
  const openHref = useOpenPlaceHref();
  return useCallback(
    (place: GoogleOnlyPlace) => {
      const gid = googlePlaceIdOf(place);
      if (!gid) return;
      stashPendingPlace(gid, place);
      openHref(googleOpenHref(gid, place.name));
    },
    [openHref],
  );
}

export type OpenedGooglePlace = {
  href: string;
  created: boolean;
  /** The Mesita place row (Home's Like saves it, MESITA-2663). */
  id: string;
  slug: string;
};

const inFlight = new Map<string, Promise<OpenedGooglePlace>>();

/** Get-or-create once per Google Place ID; resolves to the profile route. */
export function getOrCreateGooglePlace(
  supabase: SupabaseClient,
  gid: string,
): Promise<OpenedGooglePlace> {
  const pending = inFlight.get(gid);
  if (pending) return pending;
  const run = apiCreateProject(supabase, { placeId: gid })
    .then((opened) => {
      const dest = opened.place.slug || opened.place.id;
      if (!dest) throw new Error("Couldn't open that place right now.");
      if (opened.place.id) rememberCreatedPlace(supabase, gid, opened.place.id);
      return {
        href: placeHref(dest),
        created: opened.created !== false,
        id: opened.place.id,
        slug: opened.place.slug,
      };
    })
    .finally(() => inFlight.delete(gid));
  inFlight.set(gid, run);
  return run;
}
