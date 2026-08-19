// memo-cache.ts — a tiny TTL cache for Memo's config-ish reads.
//
// Routing Memo through Edge Functions (see memo-data.ts) turned in-process
// reads into network hops on the consumer's SYNCHRONOUS chat path. This buys
// most of that back for the two reads that repeat: the app_config singleton
// and one user's persona clause.
//
// Isolate-local and short-lived BY DESIGN. Entries live in one Edge Function
// instance's memory and vanish with it; there is no cross-instance coherence
// and none is wanted. This is a latency cache, not a store — keep it that way.

export type TtlCache<T> = {
  // Returns the cached value when one is live. `ttlMs <= 0` disables the cache
  // entirely, which is how a caller opts out (the admin Playground does).
  get(key: string, ttlMs: number): { hit: true; value: T } | { hit: false };
  set(key: string, value: T, ttlMs: number): void;
  // Test/ops affordance — entries currently held (live or not yet reaped).
  size(): number;
};

type Entry<T> = { value: T; expires: number };

// `maxEntries` bounds a per-user cache in a warm isolate serving many people.
// Eviction is oldest-inserted-first (Map preserves insertion order) — good
// enough for a seconds-long latency cache, and deliberately not an LRU.
export function createTtlCache<T>(maxEntries?: number): TtlCache<T> {
  const entries = new Map<string, Entry<T>>();

  return {
    get(key, ttlMs) {
      if (ttlMs <= 0) return { hit: false };
      const entry = entries.get(key);
      if (!entry) return { hit: false };
      if (entry.expires <= Date.now()) {
        entries.delete(key);
        return { hit: false };
      }
      return { hit: true, value: entry.value };
    },

    set(key, value, ttlMs) {
      if (ttlMs <= 0) return;
      // Delete first so a re-set moves the key to the end of the insertion
      // order — otherwise refreshing a hot key leaves it first in line to be
      // evicted, which is precisely backwards.
      entries.delete(key);
      entries.set(key, { value, expires: Date.now() + ttlMs });
      if (maxEntries && entries.size > maxEntries) {
        const oldest = entries.keys().next();
        if (!oldest.done) entries.delete(oldest.value);
      }
    },

    size() {
      return entries.size;
    },
  };
}
