"use client";

// The hook over lib/screen-cache.ts (MESITA-3014): paint what is kept, ask
// again when it is older than `ttl`, and show the placeholder only on a real
// miss. `seed` is a value the server already read (the shell layout's
// profile), used while the store is empty so a hard load renders real data
// in its HTML too.

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
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
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(
    null,
  );
  const [nonce, setNonce] = useState(0);

  const at = entry?.at ?? null;
  useEffect(() => {
    if (!key) return;
    const fresh = at != null && Date.now() - at < ttl && nonce === 0;
    if (fresh) return;
    let cancelled = false;
    fetchCached(key, fetch).then(
      () => {
        if (!cancelled) setFailed(null);
      },
      (e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setFailed({ key, message });
      },
    );
    return () => {
      cancelled = true;
    };
    // `fetch` is a fresh closure every render; the key names the read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const data = entry?.value ?? seed;
  const error = data == null && failed?.key === key ? failed.message : null;
  return {
    data,
    loading: data == null && error == null && key != null,
    error,
    reload,
  };
}
