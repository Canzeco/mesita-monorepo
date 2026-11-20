"use client";

import { useCallback, useEffect, useState } from "react";
import { apiListPayPlaces, type PayPlace } from "@/lib/api/wallet";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";

/** The places the guest can pay at now (consumer-web-list-pay-places,
 *  nearest first when `at` is known). Read at once, again when `at` arrives,
 *  and on `refresh`. */
export function usePayPlaces(at: { lat: number; lng: number } | null): {
  places: PayPlace[] | null;
  failed: boolean;
  loading: boolean;
  refresh: () => void;
} {
  const getSupabase = useLazyBrowserSupabase();
  const [places, setPlaces] = useState<PayPlace[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const atKey = at ? `${at.lat},${at.lng}` : "";
  const requestKey = `${nonce}:${atKey}`;
  const loading = settledKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    void apiListPayPlaces(getSupabase(), at)
      .then((list) => {
        if (cancelled) return;
        setPlaces(list);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setSettledKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
    // getSupabase is a new function each render (useLazyBrowserSupabase):
    // listing it would re-read in a loop. `at` is keyed by atKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, atKey]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { places, failed, loading, refresh };
}
