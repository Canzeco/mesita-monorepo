"use client";

import { useEffect, useRef, useState } from "react";
import { listUnits, searchUnits, type UnitHit } from "./actions";

const SEARCH_DEBOUNCE_MS = 1000;

type Options = {
  /** When false, skip loading the full catalog until the user types. */
  browseOnEmpty?: boolean;
  debounceMs?: number;
};

function filterUnits(units: UnitHit[], query: string): UnitHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return units.filter(
    (u) =>
      u.name.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q) ||
      u.slug?.toLowerCase().includes(q) ||
      u.address?.toLowerCase().includes(q) ||
      u.category?.toLowerCase().includes(q) ||
      u.category_label?.toLowerCase().includes(q),
  );
}

export function useUnitCatalogSearch(options: Options = {}) {
  const { browseOnEmpty = true, debounceMs = SEARCH_DEBOUNCE_MS } = options;
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [catalog, setCatalog] = useState<UnitHit[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [hits, setHits] = useState<UnitHit[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
  const [mode, setMode] = useState<"browse" | "search" | "idle">(
    browseOnEmpty ? "browse" : "idle",
  );
  const requestIdRef = useRef(0);

  // Load catalog once.
  useEffect(() => {
    if (!browseOnEmpty) return;
    let cancelled = false;
    void (async () => {
      const r = await listUnits();
      if (cancelled) return;
      if (!r.ok) {
        setError(r.error);
        setCatalog([]);
        setCatalogLoaded(true);
        return;
      }
      setCatalog(r.data);
      setCatalogLoaded(true);
      setHits(r.data);
      setMode("browse");
    })();
    return () => {
      cancelled = true;
    };
  }, [browseOnEmpty]);

  // Debounce search input — wait for typing to stop before searching.
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length >= 2) {
      setSearchedQuery(null);
    }
    const t = setTimeout(() => setDebouncedQ(trimmed), debounceMs);
    return () => clearTimeout(t);
  }, [q, debounceMs]);

  // Run search only after debounce settles.
  useEffect(() => {
    const query = debouncedQ;
    if (query.length === 0) {
      if (browseOnEmpty && catalogLoaded) {
        setHits(catalog);
        setMode("browse");
      } else if (!browseOnEmpty) {
        setHits([]);
        setMode("idle");
      }
      setSearchedQuery(null);
      setPending(false);
      return;
    }
    if (query.length < 2) {
      if (browseOnEmpty && catalogLoaded) {
        setHits(catalog);
        setMode("browse");
      } else {
        setHits([]);
        setMode("idle");
      }
      setSearchedQuery(null);
      setPending(false);
      return;
    }

    setMode("search");
    if (catalog.length > 0) {
      setHits(filterUnits(catalog, query));
    }

    const id = ++requestIdRef.current;
    setPending(true);
    setError(null);

    void searchUnits(query).then((r) => {
      if (id !== requestIdRef.current) return;
      setPending(false);
      setSearchedQuery(query);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setHits(r.data);
    });
  }, [debouncedQ, catalog, catalogLoaded, browseOnEmpty]);

  const trimmed = q.trim();
  const waiting =
    trimmed.length >= 2 && trimmed !== debouncedQ;
  const searching = pending || waiting;

  const metaLabel =
    mode === "idle"
      ? "Type to search"
      : mode === "browse"
        ? !catalogLoaded || searching
          ? "Loading catalog…"
          : `Recent units · ${hits.length}`
        : searching
          ? "Searching…"
          : `Results · ${hits.length}`;

  const clear = () => {
    setQ("");
    setDebouncedQ("");
    setSearchedQuery(null);
  };

  return {
    q,
    setQ,
    hits,
    pending: searching,
    error,
    mode,
    metaLabel,
    searchedQuery,
    clear,
  };
}
