"use client";

import { useState } from "react";
import {
  PlaceRequestPanelView,
  requestProgressLabel,
  requestProgressMeta,
} from "@mesita/place-profile";

import { apiRequestPlace } from "@/lib/api/places";
import type { PlaceDetail } from "@/lib/place-detail";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { errMsg } from "@/lib/utils";

export { PlaceRequestPanelView, requestProgressLabel, requestProgressMeta };

export function PlaceRequestPanel({ place }: { place: PlaceDetail }) {
  const supabase = useBrowserSupabase();
  const [count, setCount] = useState(place.request_count);
  const [threshold, setThreshold] = useState(place.request_threshold);
  const [requested, setRequested] = useState(place.requested);
  const [enriching, setEnriching] = useState(place.is_enriching);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async () => {
    if (requested || pending) return;
    setPending(true);
    setError(null);
    try {
      const r = await apiRequestPlace(supabase, place.id);
      setCount(r.request_count);
      setThreshold(r.request_threshold);
      setRequested(r.requested);
      if (r.enrichment_triggered) setEnriching(true);
    } catch (err) {
      setError(errMsg(err, "Could not send the vote."));
    } finally {
      setPending(false);
    }
  };

  return (
    <PlaceRequestPanelView
      count={count}
      threshold={threshold}
      requested={requested}
      enriching={enriching}
      pending={pending}
      error={error}
      onRequest={() => void request()}
    />
  );
}
