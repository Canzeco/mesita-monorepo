"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  DEFAULT_SEARCH_COUNTRY,
  readStoredLocationOptOut,
  readStoredSearchCountry,
  writeStoredLocationOptOut,
  writeStoredSearchCountry,
} from "@/lib/search-scope";

const SCOPE_EVENT = "mesita-search-scope";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SCOPE_EVENT, onStoreChange);
  return () => window.removeEventListener(SCOPE_EVENT, onStoreChange);
}

function emitScope() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SCOPE_EVENT));
}

/** Country + location-opt-out for the Search bar. Backed by localStorage. */
export function useSearchScope() {
  const country = useSyncExternalStore(
    subscribe,
    readStoredSearchCountry,
    () => DEFAULT_SEARCH_COUNTRY,
  );
  const locationOptOut = useSyncExternalStore(
    subscribe,
    readStoredLocationOptOut,
    () => false,
  );

  const setCountry = useCallback((next: string | null) => {
    writeStoredSearchCountry(next);
    emitScope();
  }, []);

  const setLocationOptOut = useCallback((next: boolean) => {
    writeStoredLocationOptOut(next);
    emitScope();
  }, []);

  return { country, setCountry, locationOptOut, setLocationOptOut };
}
