"use client";

// The hook over lib/screen-cache.ts (MESITA-3014): paint what is kept, ask
// again when it is older than `ttl`, and show the placeholder only on a real
// miss. `seed` is a value the server already read (the shell layout's
// profile), used while the store is empty so a hard load renders real data
// in its HTML too.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  fetchCached,
  readCachedEntry,
  screenCacheVersion,
  subscribeScreenCache,
} from "./screen-cache";

export type CachedQuery<T> = {
  /** The kept (or seeded) value, else null. */
  data: T | null;
  /** True only while there is nothing to paint and a read is out. */
  loading: boolean;
  /** The last read failed and there is nothing to paint. */
  error: string | null;
  /** The failed read's HTTP status when it carried one (an EFError's
   *  404 / 400), so a screen can tell "gone" from "offline" (MESITA-4747). */
  errorStatus: number | null;
  /** Ask again now. */
  reload: () => void;
};

export function useCachedQuery<T>(
  key: string | null,
  fetch: () => Promise<T>,
  { ttl, seed = null }: { ttl: number; seed?: T | null },
): CachedQuery<T> {
  useSyncExternalStore(subscribeScreenCache, screenCacheVersion, () => 0);
  const entry = key ? readCachedEntry<T>(key) : null;
  const [failed, setFailed] = useState<{ key: string; message: string; status: number | null } | null>(
    null,
  );
  const [nonce, setNonce] = useState(0);

  const at = entry?.at ?? null;
  // An invalidated key reads again while its reader is mounted. A failed read
  // leaves it missing, so it never loops.
  const missing = at == null;
  const askedNonce = useRef(0);
  useEffect(() => {
    if (!key) return;
    // reload() forces one read; the answer landing must not force another.
    const forced = askedNonce.current !== nonce;
    askedNonce.current = nonce;
    const fresh = at != null && Date.now() - at < ttl && !forced;
    if (fresh) return;
    let cancelled = false;
    fetchCached(key, fetch).then(
      () => setFailed((f) => (f?.key === key ? null : f)),
      (e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        const status =
          e && typeof e === "object" && "status" in e && typeof e.status === "number" ? e.status : null;
        setFailed({ key, message, status });
      },
    );
    return () => {
      cancelled = true;
    };
    // `fetch` is a fresh closure every render; the key names the read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce, missing]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const data = entry?.value ?? seed;
  const error = data == null && failed?.key === key ? failed.message : null;
  return {
    data,
    loading: data == null && error == null && key != null,
    error,
    errorStatus: error != null ? (failed?.status ?? null) : null,
    reload,
  };
}
