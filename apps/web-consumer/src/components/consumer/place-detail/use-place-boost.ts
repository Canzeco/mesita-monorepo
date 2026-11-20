"use client";

import { useEffect, useState } from "react";
import { readCached, writeCached } from "@/lib/screen-cache";
import { isMesitaPlaceId } from "@/lib/api/activity";
import { apiGetBoost, type PlaceBoost } from "@/lib/api/boost";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";

// Premier (MESITA-3168): the place's level and the guest's Refill packs.
// Checkout returns to /place/<id>/upgrade?refill=<session> (MESITA-4111):
// settle it, say what happened only from the server's line, and drop the
// parameter so a reload does not settle twice. A payment still confirming
// is asked again for up to 20 seconds.
const CONFIRM_POLL_MS = 2_500;
const CONFIRM_POLL_FOR_MS = 20_000;

function sayCheckoutOutcome(data: PlaceBoost) {
  const p = data.purchase;
  if (!p) return;
  if (p.status === "granted") toast.success(`${p.line}.`);
  else if (p.status === "open")
    toast(
      "Still confirming. This updates on its own; you won't be charged twice.",
    );
  else toast(`${p.line}.`);
}

const boostKey = (placeId: string) => `boost:${placeId}`;

export function usePlaceBoost(placeId: string): {
  data: PlaceBoost | null;
  loading: boolean;
  failed: boolean;
  reload: () => void;
} {
  const getSupabase = useLazyBrowserSupabase();
  const mesita = isMesitaPlaceId(placeId);
  const [state, setState] = useState<{
    placeId: string;
    nonce: number;
    data: PlaceBoost | null;
    failed: boolean;
  }>(() => ({
    placeId,
    nonce: -1,
    // A boost read kept from an earlier open paints at once (MESITA-3014).
    data: readCached<PlaceBoost>(boostKey(placeId)),
    failed: false,
  }));
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!mesita) return;
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const session = params.get("refill") ?? undefined;
    if (session) {
      params.delete("refill");
      const q = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${q ? `?${q}` : ""}`,
      );
    }
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = (): Promise<PlaceBoost> =>
      apiGetBoost(getSupabase(), placeId, session).then((data) => {
        if (
          session &&
          !cancelled &&
          data.purchase?.status === "open" &&
          Date.now() - startedAt < CONFIRM_POLL_FOR_MS
        ) {
          return new Promise<PlaceBoost>((resolve, reject) => {
            timer = setTimeout(
              () => void read().then(resolve, reject),
              CONFIRM_POLL_MS,
            );
          });
        }
        return data;
      });
    if (session) toast("Confirming your payment…");
    void read()
      .then((data) => {
        if (cancelled) return;
        setState({ placeId, nonce, data, failed: false });
        // A checkout return reads fresh and is never served from the store;
        // its answer still updates what the next open paints.
        writeCached(boostKey(placeId), data);
        if (session) sayCheckoutOutcome(data);
      })
      .catch(() => {
        if (!cancelled)
          setState((s) => ({
            placeId,
            nonce,
            data: s.placeId === placeId ? s.data : null,
            failed: true,
          }));
      });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId, mesita, nonce]);

  const fresh = state.placeId === placeId;
  const data = mesita && fresh ? state.data : null;
  return {
    data,
    // A kept read is shown while the fresh one is out, so it is not loading.
    loading: mesita && (!fresh || state.nonce !== nonce) && data == null,
    failed: mesita && fresh && state.failed,
    reload: () => setNonce((n) => n + 1),
  };
}
