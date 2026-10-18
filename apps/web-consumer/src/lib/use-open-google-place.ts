"use client";

// Opening a Google-only result's full profile (MESITA-2298). This is the ONE
// consumer action that creates a Mesita Place: consumer-web-create-place is
// get-or-create on the Google Place ID, so a held id opens its row and a new
// id creates the ugly profile, then the profile route opens. Nothing here
// runs on render, on a pin tap, on scroll or on a prefetch; a card calls it
// from a deliberate tap only.

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiCreateProject } from "@/lib/api/place-search";
import { placeHref } from "@/lib/place-route";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { errMsg } from "@/lib/utils";

export type GoogleOnlyPlace = {
  name: string;
  slug?: string | null;
  google_place_id?: string | null;
};

/** The Google Place ID a Google-only row carries: the id, else the slug. */
export function googlePlaceIdOf(place: GoogleOnlyPlace): string | null {
  const gid = place.google_place_id ?? place.slug;
  return gid && gid.trim() ? gid : null;
}

export function useOpenGooglePlace(): (place: GoogleOnlyPlace) => void {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  const inFlight = useRef<Set<string>>(new Set());
  return useCallback(
    (place: GoogleOnlyPlace) => {
      const gid = googlePlaceIdOf(place);
      if (!gid || inFlight.current.has(gid)) return;
      inFlight.current.add(gid);
      void (async () => {
        try {
          const opened = await apiCreateProject(supabase, { placeId: gid });
          const dest = opened.place.slug || opened.place.id;
          if (opened.created !== false) {
            toast.success(`${place.name} is on Mesita. Vote to enrich its profile.`);
          }
          if (dest) router.push(placeHref(dest));
        } catch (err) {
          toast.error(errMsg(err, "Couldn't open that place right now."));
        } finally {
          inFlight.current.delete(gid);
        }
      })();
    },
    [router, supabase],
  );
}
