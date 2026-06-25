"use client";

import { useEffect, useRef, useState } from "react";
import { listUnits, searchUnits, type UnitHit } from "./actions";

type Options = {
  /** When false, skip loading the full catalog until the user types. */
  browseOnEmpty?: boolean;
  debounceMs?: number;
  /** Label style for the meta line under the search field. */
  variant?: "edit" | "multiple";
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
  const { browseOnEmpty = true, debounceMs = 280, variant = "edit" } = options;
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [catalog, setCatalog] = useState<UnitHit[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [hits, setHits] = useState<UnitHit[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  // Debounce server search input.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), debounceMs);
    return () => clearTimeout(t);
  }, [q, debounceMs]);

  // Instant client-side filter while typing.
  useEffect(() => {
    const query = q.trim();
    if (query.length === 0) {
      if (browseOnEmpty && catalogLoaded) {
        setHits(catalog);
        setMode("browse");
      } else if (!browseOnEmpty) {
        setHits([]);
        setMode("idle");
      }
      return;
    }
    if (query.length < 2) {
      setHits([]);
      setMode(browseOnEmpty ? "browse" : "idle");
      return;
    }
    setMode("search");
    if (catalog.length > 0) {
      setHits(filterUnits(catalog, query));
    }
  }, [q, catalog, catalogLoaded, browseOnEmpty]);

  // Authoritative server search (debounced).
  useEffect(() => {
    const query = debouncedQ;
    if (query.length < 2) {
      setPending(false);
      return;
    }

    const id = ++requestIdRef.current;
    setPending(true);
    setError(null);

    void searchUnits(query).then((r) => {
      if (id !== requestIdRef.current) return;
      setPending(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setHits(r.data);
    });
  }, [debouncedQ]);

  const metaLabel =
    mode === "idle"
      ? "Type to search"
      : mode === "browse"
        ? !catalogLoaded || pending
          ? variant === "multiple"
            ? "Loading…"
            : "Loading catalog…"
          : variant === "multiple"
            ? `${hits.length} on Mesita`
            : `Recent units · ${hits.length}`
        : pending
          ? variant === "multiple"
            ? "Searching…"
            : "Searching…"
          : variant === "multiple"
            ? `${hits.length} match${hits.length === 1 ? "" : "es"}`
            : `Results · ${hits.length}`;

  return { q, setQ, hits, pending, error, mode, metaLabel, clear: () => setQ("") };
}
