"use client";

import { useEffect, useRef, useState } from "react";
import { listPlaces, searchPlacesCatalog, type PlaceHit } from "./actions";

const SEARCH_DEBOUNCE_MS = 1000;

type Options = {
  /** When false, skip loading the full catalog until the user types. */
  browseOnEmpty?: boolean;
  debounceMs?: number;
};

function filterPlaces(places: PlaceHit[], query: string): PlaceHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return places.filter(
    (u) =>
      u.name.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q) ||
      u.address?.toLowerCase().includes(q) ||
      u.zone?.toLowerCase().includes(q) ||
      u.category?.toLowerCase().includes(q) ||
      u.category_label?.toLowerCase().includes(q),
  );
}

// Catalog browse + debounced remote search for the place picker. The effects do
// nothing but async work (their setState calls land after an await), while the
// visible state — hits, mode, pending, searchedQuery, error — is derived during
// render from the query, the loaded catalog, and the last query-keyed result.
export function usePlaceCatalogSearch(options: Options = {}) {
  const { browseOnEmpty = true, debounceMs = SEARCH_DEBOUNCE_MS } = options;
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [catalog, setCatalog] = useState<PlaceHit[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [remote, setRemote] = useState<{ query: string; hits: PlaceHit[] } | null>(null);
  const [remoteError, setRemoteError] = useState<{ query: string; message: string } | null>(null);
  const requestIdRef = useRef(0);

  // Load the browse catalog once.
  useEffect(() => {
    if (!browseOnEmpty) return;
    let cancelled = false;
    void (async () => {
      const r = await listPlaces();
      if (cancelled) return;
      if (!r.ok) {
        setCatalog([]);
        setCatalogError(r.error);
      } else {
        setCatalog(r.data);
      }
      setCatalogLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [browseOnEmpty]);

  // Debounce the query — schedule only, never setState synchronously.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), debounceMs);
    return () => clearTimeout(t);
  }, [q, debounceMs]);

  // Run the authoritative remote search once the debounce settles. Results and
  // errors are keyed by their query so render can tell fresh from stale.
  useEffect(() => {
    const query = debouncedQ.trim();
    if (query.length < 2) return;
    const id = ++requestIdRef.current;
    void (async () => {
      const r = await searchPlacesCatalog(query);
      if (id !== requestIdRef.current) return;
      if (!r.ok) {
        setRemoteError({ query, message: r.error });
        return;
      }
      setRemoteError(null);
      setRemote({ query, hits: r.data });
    })();
  }, [debouncedQ]);

  // ─── Derived view state (no effects, no cascading renders) ───
  const dq = debouncedQ.trim();
  const qTrimmed = q.trim();
  const remoteReady = remote !== null && remote.query === dq;
  const remoteFailed = remoteError !== null && remoteError.query === dq;

  const browseHits = browseOnEmpty && catalogLoaded ? catalog : [];
  const hits: PlaceHit[] =
    dq.length < 2
      ? browseHits
      : remote !== null && remote.query === dq
        ? remote.hits
        : catalog.length > 0
          ? filterPlaces(catalog, dq) // optimistic local filter until remote lands
          : [];

  const searchedQuery = remoteReady ? dq : null;
  const error = remoteFailed && remoteError ? remoteError.message : catalogError;

  const mode: "browse" | "search" | "idle" =
    dq.length >= 2 ? "search" : browseOnEmpty ? "browse" : "idle";

  // Spinner is on while the debounce is still settling (user typed ≥2) or a
  // remote search is in flight for the settled query.
  const waiting = qTrimmed.length >= 2 && qTrimmed !== dq;
  const fetching = dq.length >= 2 && !remoteReady && !remoteFailed;
  const searching = waiting || fetching;

  const metaLabel =
    mode === "idle"
      ? "Type to search"
      : mode === "browse"
        ? !catalogLoaded || searching
          ? "Loading catalog…"
          : `Recent places · ${hits.length}`
        : searching
          ? "Searching…"
          : `Results · ${hits.length}`;

  const clear = () => {
    setQ("");
    setDebouncedQ("");
  };

  return {
    q,
    setQ,
    /** Debounced trimmed query — use to fan out parallel lookups (e.g. Google). */
    debouncedQuery: dq,
    hits,
    pending: searching,
    error,
    mode,
    metaLabel,
    searchedQuery,
    clear,
  };
}
