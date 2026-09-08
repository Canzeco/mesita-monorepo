"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiListCreditBalances,
  type CreditOrgBalance,
} from "@/lib/api/credits";
import { useBrowserSupabase } from "@/lib/supabase/browser";

// React binding for the Wallet's real balance read (MESITA-1674). Replaces
// src/lib/mock/use-credits.ts — the browser emulator this package ran on.
//
// THE CLOCK IS THE SERVER'S. consumer-web-list-credit-balances stamps every
// response with serverNowMs — the same clock its own pending/expired split
// was computed against. This hook captures the OFFSET between that and the
// device's own Date.now() once, at load, and ticks nowMs forward from there
// every minute (the same cadence the old emulator's countdown used) rather
// than trusting the guest's device clock outright.
const TICK_MS = 60_000;

export type CreditBalancesApi = {
  organizations: CreditOrgBalance[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  /** Server-anchored wall time. Every expiry/activation read derives from this. Null before the first load. */
  nowMs: number | null;
  loadMore: () => Promise<void>;
  reload: () => Promise<void>;
};

export function useCreditBalances(): CreditBalancesApi {
  const supabase = useBrowserSupabase();
  const [organizations, setOrganizations] = useState<CreditOrgBalance[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Wall time is STATE, not a render-time `Date.now() + offset` read —
  // calling Date.now() during render is impure (React may re-render at any
  // moment and the value would move under it, which is what the
  // react-hooks/purity rule rejects) and use-credits.ts carried the same
  // rule for the same reason. The OFFSET between the server's clock and this
  // device's is captured once, in a ref, at load; `nowMs` state only ever
  // moves inside an effect.
  const [nowMs, setNowMs] = useState<number | null>(null);
  const clockOffsetMsRef = useRef(0);
  // Guards a fetch racing an unmount (route change while a request is in
  // flight) from setting state on a component that no longer cares.
  const aliveRef = useRef(true);
  useEffect(() => () => {
    aliveRef.current = false;
  }, []);
  // Fires the first load exactly once — same guard useConsumerCards uses
  // (CardList.tsx) for the same reason: an unconditional `void load()` in the
  // effect body sets state synchronously on every dependency change, which
  // react-hooks/set-state-in-effect rejects outright.
  const requestedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiListCreditBalances(supabase);
      if (!aliveRef.current) return;
      setOrganizations(res.organizations);
      setCursor(res.nextCursor);
      clockOffsetMsRef.current = res.serverNowMs - Date.now();
      setNowMs(res.serverNowMs);
    } catch {
      if (!aliveRef.current) return;
      setError("Couldn't load your Credits. Pull to refresh and try again.");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    void load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => {
      setNowMs(Date.now() + clockOffsetMsRef.current);
    }, TICK_MS);
    return () => clearInterval(t);
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await apiListCreditBalances(supabase, { cursor });
      if (!aliveRef.current) return;
      // Appended, never replaced: a second page is MORE organizations, not a
      // reload of the first. The server ranking is stable across pages
      // (rankOrgBalances's tiebreaks depend only on each org's own totals and
      // name, never on the requesting page), so there is no dedupe question.
      setOrganizations((prev) => [...prev, ...res.organizations]);
      setCursor(res.nextCursor);
    } catch {
      if (!aliveRef.current) return;
      setError("Couldn't load more — try again.");
    } finally {
      if (aliveRef.current) setLoadingMore(false);
    }
  }, [cursor, loadingMore, supabase]);

  return {
    organizations,
    loading,
    loadingMore,
    error,
    hasMore: cursor !== null,
    nowMs,
    loadMore,
    reload: load,
  };
}
