// THE SCREENS' DATA, KEPT (MESITA-3014). Every screen used to fetch its Edge
// Function on every mount, so a tab you had just left came back as a
// skeleton. This is one in-memory store, keyed per read: a screen paints
// what is here at once and revalidates in the background; a miss shows the
// screen's placeholder and fetches once, however many components ask.
//
// REACT-FREE ON PURPOSE. lib/api/profile.ts writes through here and is also
// imported by Server Components (the (shell) layout), so this module must not
// import a hook. use-cached-query.ts is the hook.
//
// CLIENT-ONLY WRITES. Module memory on the server is shared by every request
// of every guest, so nothing is ever stored there: a write without `window`
// is dropped.
//
// PER ACCOUNT. reconcileConsumerLocalOwner (consumer-local-reset.ts) calls
// clearScreenCache() when a different consumer owns the browser, so account
// B never paints account A's rows after a sign-out and sign-in (both are soft
// navigations; module memory survives them).

type Entry = { at: number; value: unknown };

const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();
let version = 0;

const onClient = () => typeof window !== "undefined";

function emit(): void {
  version += 1;
  for (const listener of listeners) listener();
}

export function subscribeScreenCache(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Changes on every write, for useSyncExternalStore. */
export function screenCacheVersion(): number {
  return version;
}

/** The kept value and when it was written, or null. */
export function readCachedEntry<T>(
  key: string,
): { value: T; at: number } | null {
  const hit = entries.get(key);
  return hit ? { value: hit.value as T, at: hit.at } : null;
}

export function readCached<T>(key: string): T | null {
  return readCachedEntry<T>(key)?.value ?? null;
}

/** Keep `value` under `key` and tell every reader. */
export function writeCached<T>(key: string, value: T, now = Date.now()): void {
  if (!onClient()) return;
  entries.set(key, { at: now, value });
  emit();
}

/** Keep a server-read value only when nothing newer is here: a write from
 *  this browser always wins over a later render of the layout. Silent (no
 *  emit), because it runs during render, before its readers mount. */
export function seedCached<T>(key: string, value: T, now = Date.now()): void {
  if (!onClient() || entries.has(key)) return;
  entries.set(key, { at: now, value });
}

export function invalidateCached(key: string): void {
  if (!entries.delete(key)) return;
  emit();
}

/** Forget everything (account change). Silent: it runs during the shell's
 *  first render, when no reader is mounted yet. */
export function clearScreenCache(): void {
  entries.clear();
  inflight.clear();
}

/** One request per key at a time; the answer is kept. */
export function fetchCached<T>(
  key: string,
  fetch: () => Promise<T>,
): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const request = fetch()
    .then((value) => {
      if (inflight.get(key) === request) writeCached(key, value);
      return value;
    })
    .finally(() => {
      if (inflight.get(key) === request) inflight.delete(key);
    });
  inflight.set(key, request);
  return request;
}

export const PROFILE_KEY = "profile";
