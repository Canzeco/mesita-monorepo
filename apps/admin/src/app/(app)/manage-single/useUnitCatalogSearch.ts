"use client";

import { useEffect, useState, useTransition } from "react";
import { listUnits, searchUnits, type UnitHit } from "./actions";

type Options = {
  /** When false, skip loading the full catalog until the user types. */
  browseOnEmpty?: boolean;
};

export function useUnitCatalogSearch(options: Options = {}) {
  const { browseOnEmpty = true } = options;
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<UnitHit[]>([]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"browse" | "search" | "idle">(
    browseOnEmpty ? "browse" : "idle",
  );

  useEffect(() => {
    start(async () => {
      setError(null);
      const query = q.trim();
      if (query.length === 0) {
        if (!browseOnEmpty) {
          setMode("idle");
          setHits([]);
          return;
        }
        setMode("browse");
        const r = await listUnits();
        if (!r.ok) {
          setError(r.error);
          setHits([]);
          return;
        }
        setHits(r.data);
        return;
      }
      if (query.length < 2) {
        setHits([]);
        setMode(browseOnEmpty ? "browse" : "idle");
        return;
      }
      setMode("search");
      const r = await searchUnits(query);
      if (!r.ok) {
        setError(r.error);
        setHits([]);
        return;
      }
      setHits(r.data);
    });
  }, [q, browseOnEmpty]);

  const metaLabel =
    mode === "idle"
      ? "Type to search"
      : mode === "browse"
        ? pending
          ? "Loading catalog…"
          : `Recent units · ${hits.length}`
        : pending
          ? "Searching…"
          : `Results · ${hits.length}`;

  return { q, setQ, hits, pending, error, mode, metaLabel, clear: () => setQ("") };
}
