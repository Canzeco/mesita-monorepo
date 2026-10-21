"use client";

// Home's Social tab dot (MESITA-2536): while the guest is elsewhere on Home,
// ask for the feed every SOCIAL_DOT_MS and light the dot when its newest
// event is newer than the last one they saw (lib/social-seen.ts). Half the
// Social pane's own rate, so Places costs the server little. Off while the
// Social tab itself is open: the pane marks what it shows.

import { useEffect, useState } from "react";
import { apiListActivityFeed } from "@/lib/api/activity";
import { useActiveLocation } from "@/lib/active-location";
import { useUserLocation } from "@/lib/use-user-location";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { hasUnseen, useSocialSeenAt } from "@/lib/social-seen";

export const SOCIAL_DOT_MS = 60_000;

export function useSocialHasNew(enabled: boolean): boolean {
  const supabase = useBrowserSupabase();
  const coords = useUserLocation();
  const origin = useActiveLocation();
  const from = origin ?? coords;
  const fromKey = from
    ? `${from.lat.toFixed(2)},${from.lng.toFixed(2)}`
    : "none";
  const seenAt = useSocialSeenAt();
  const [newestAt, setNewestAt] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const check = () =>
      apiListActivityFeed(
        supabase,
        from ? { lat: from.lat, lng: from.lng } : null,
      )
        .then((items) => {
          if (!cancelled) setNewestAt(items[0]?.at ?? null);
        })
        // A missed check just leaves the dot as it was.
        .catch(() => {});
    check();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") check();
    }, SOCIAL_DOT_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, fromKey, enabled]);

  return enabled && hasUnseen(newestAt, seenAt);
}
