"use client";

// Save and Share on a preview card: the Home tile and the Search map card
// (MESITA-2668). A Mesita place saves to this browser's favorites and shares
// its own page.
//
// GOOGLE-ONLY SAVE AND SHARE (Pato, MESITA-2663: "just create the profile
// and then trigger it"). Save get-or-creates on the Google Place ID (the
// same door a profile open uses) and saves the created place; the card
// remembers the new id so it reads Saved. Share must fire inside the tap
// (the OS sheet needs the activation), so it shares the opening link at
// once — that screen get-or-creates — and starts the create behind it.

import { useState } from "react";
import type { Place } from "@/lib/api/places";
import { isGoogleOnlyPlace } from "@/lib/place-placeholder";
import {
  removeSavedPlacePreview,
  upsertSavedPlacePreview,
  useSavedPlaces,
} from "@/lib/saved-places";
import { shareOrCopy, sharePlace } from "@/lib/share-place";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import {
  getOrCreateGooglePlace,
  googleOpenHref,
  googlePlaceIdOf,
} from "@/lib/use-open-google-place";
import { errMsg } from "@/lib/utils";

export type CardSaveShare = {
  isSaved: (place: Place) => boolean;
  /** Save or unsave; `rank` rides along to `onSaved` for analytics. */
  toggle: (place: Place, rank?: number) => void;
  share: (place: Place) => void;
};

/** `onSaved` fires on a save (never an unsave), with the saved row. */
export function useCardSaveShare(
  onSaved?: (place: Place, rank: number) => void,
): CardSaveShare {
  const supabase = useBrowserSupabase();
  const { savedIds, setSaved } = useSavedPlaces();
  const [createdIds, setCreatedIds] = useState<Record<string, string>>({});

  const isSaved = (place: Place) => {
    if (savedIds.has(place.id)) return true;
    const gid = isGoogleOnlyPlace(place) ? googlePlaceIdOf(place) : null;
    const madeId = gid ? createdIds[gid] : undefined;
    return madeId ? savedIds.has(madeId) : false;
  };

  const toggleSaved = (place: Place, saved: boolean, rank: number) => {
    if (saved) {
      setSaved(place.id, false);
      removeSavedPlacePreview(place.id);
      toast.action("Removed from favorites", {
        label: "Undo",
        onClick: () => {
          upsertSavedPlacePreview(place);
          setSaved(place.id, true);
        },
      });
      return;
    }
    upsertSavedPlacePreview(place);
    setSaved(place.id, true);
    onSaved?.(place, rank);
  };

  const saveGoogle = async (place: Place, saved: boolean, rank: number) => {
    const gid = googlePlaceIdOf(place);
    if (!gid) return;
    try {
      const made = await getOrCreateGooglePlace(supabase, gid);
      setCreatedIds((m) => ({ ...m, [gid]: made.id }));
      toggleSaved({ ...place, id: made.id, slug: made.slug }, saved, rank);
    } catch (e) {
      toast.error(errMsg(e, "Couldn't save that place right now."));
    }
  };

  const shareGoogle = (place: Place) => {
    const gid = googlePlaceIdOf(place);
    if (!gid) return;
    const url = new URL(
      googleOpenHref(gid, place.name),
      window.location.origin,
    ).toString();
    void shareOrCopy(
      { title: place.name, url },
      { text: url, copied: "Link copied", failed: "Couldn't share this place" },
    );
    void getOrCreateGooglePlace(supabase, gid).catch(() => {});
  };

  return {
    isSaved,
    toggle: (place, rank = 0) => {
      const saved = isSaved(place);
      if (isGoogleOnlyPlace(place)) void saveGoogle(place, saved, rank);
      else toggleSaved(place, saved, rank);
    },
    share: (place) => {
      if (isGoogleOnlyPlace(place)) shareGoogle(place);
      else void sharePlace(place);
    },
  };
}
