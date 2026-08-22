"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { apiGetRewardQuotes, type RewardQuote } from "@/lib/api/tickets";
import { useBrowserSupabase } from "@/lib/supabase/browser";

// Engine discount quotes, cached for the whole shell (MESITA-1019).
//
// The promo chip renders on four surfaces — swipe card, favorites tile,
// catalog tile, place-detail header — and each one used to resolve its own
// percentage from the place's four v4 rate columns. Those columns carry
// strategy IDENTITY, not price; the price lives in `promos_config.v11`, which
// only the server reads. So the number has to come from
// `consumer-web-get-discount-quote`, and the chip can't be the thing that
// calls it once per card.
//
// This is the batching layer. A chip declares interest in a place id; the ids
// gathered during one commit flush as ONE request on the following microtask,
// so a twenty-tile favorites grid costs a single round trip and a swipe deck
// can warm its whole sample up front via `usePrefetchDiscountQuotes`.
//
// Cached for the session because a quote is a function of (place strategy,
// this consumer's identity, whether they've been here) — none of which move
// while the tab is open. A quote is one guest's OWN rate and must never
// outlive their session, so the shell mounts this under `key={user.id}`: a
// different consumer in the same tab gets a different provider instance and an
// empty cache, no reset effect required. Same owner-stamp rule the local
// favorites store follows (MESITA-730).
//
// A place with no answer — unknown id, or a failed request — caches `null` and
// the chip renders its empty state. Fail closed: hiding a real reward is
// recoverable, promising a dead one is not.

/** `null` = asked and got no usable answer; absent = not asked yet. */
type QuoteMap = ReadonlyMap<string, RewardQuote | null>;

type DiscountQuotesValue = {
  quotes: QuoteMap;
  request: (placeIds: readonly string[]) => void;
};

const DiscountQuotesContext = createContext<DiscountQuotesValue | null>(null);

// Matches MAX_BATCH in the Edge Function. Larger asks are chunked here rather
// than rejected there.
const MAX_BATCH = 100;

function chunk(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export function DiscountQuotesProvider({ children }: { children: ReactNode }) {
  const supabase = useBrowserSupabase();
  const [quotes, setQuotes] = useState<QuoteMap>(() => new Map());

  // Ids already asked about (resolved OR in flight), so a re-render can't
  // re-request one. Separate from `quotes` because it must be readable and
  // writable synchronously inside the effect that schedules a batch.
  const askedRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<Set<string>>(new Set());
  const flushScheduledRef = useRef(false);

  const flush = useCallback(async () => {
    flushScheduledRef.current = false;
    const ids = [...queueRef.current];
    queueRef.current = new Set();
    if (ids.length === 0) return;

    await Promise.all(
      chunk(ids, MAX_BATCH).map(async (batch) => {
        let received: Record<string, RewardQuote> = {};
        try {
          received = await apiGetRewardQuotes(supabase, batch);
        } catch {
          // Leave `received` empty: every id in this batch caches null and
          // renders as "no reward" rather than as a number nobody will honor.
        }
        setQuotes((prev) => {
          const next = new Map(prev);
          for (const id of batch) next.set(id, received[id] ?? null);
          return next;
        });
      }),
    );
  }, [supabase]);

  const request = useCallback(
    (placeIds: readonly string[]) => {
      let added = false;
      for (const id of placeIds) {
        if (!id || askedRef.current.has(id)) continue;
        askedRef.current.add(id);
        queueRef.current.add(id);
        added = true;
      }
      if (!added || flushScheduledRef.current) return;
      flushScheduledRef.current = true;
      // Microtask, not a timer: it runs after every effect in the current
      // commit, so all the chips mounted by one render batch into one request
      // — and still before paint, so nothing flashes an empty chip first.
      queueMicrotask(() => void flush());
    },
    [flush],
  );

  const value = useMemo<DiscountQuotesValue>(
    () => ({ quotes, request }),
    [quotes, request],
  );

  return (
    <DiscountQuotesContext.Provider value={value}>
      {children}
    </DiscountQuotesContext.Provider>
  );
}

/**
 * One place's engine quote, fetched on first ask and shared thereafter.
 *
 * `placeId` is nullable so a caller can gate BEFORE asking — the chip skips
 * every place the server already told it isn't promoting, which keeps a deck
 * of ordinary listings off the wire entirely.
 *
 * Outside the provider (tests mounting a component bare) this reports a
 * settled "no quote" rather than throwing: a missing chip is a better failure
 * than a crashed card.
 */
export function useDiscountQuote(placeId: string | null | undefined): {
  quote: RewardQuote | null;
  loading: boolean;
} {
  const ctx = useContext(DiscountQuotesContext);
  const request = ctx?.request;

  useEffect(() => {
    if (!placeId || !request) return;
    request([placeId]);
  }, [placeId, request]);

  if (!placeId || !ctx) return { quote: null, loading: false };
  const hit = ctx.quotes.get(placeId);
  if (hit === undefined) return { quote: null, loading: true };
  return { quote: hit, loading: false };
}

/**
 * Warm a whole surface's quotes in one request.
 *
 * The swipe deck renders one card at a time but knows its entire sample up
 * front, so without this each swipe would pay for its own round trip. Grids
 * mount every tile at once and batch on their own; calling this is harmless
 * there — ids already asked about are skipped.
 */
export function usePrefetchDiscountQuotes(
  placeIds: readonly (string | null | undefined)[],
): void {
  const ctx = useContext(DiscountQuotesContext);
  const request = ctx?.request;
  const key = placeIds.filter(Boolean).join(",");

  useEffect(() => {
    if (!request || key === "") return;
    request(key.split(","));
  }, [key, request]);
}
