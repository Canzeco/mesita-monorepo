// THE STORE, as an external store rather than React state.
//
// The scenario lives in `localStorage`, which makes it a system OUTSIDE React —
// and `useSyncExternalStore` is the primitive for exactly that. The obvious
// alternative (a `useState` seeded in a `useEffect`) is worse in three ways: it
// sets state inside an effect, which cascades a render on every mount; it
// cannot tell React that the server's snapshot and the client's legitimately
// differ; and it leaves two tabs of this app disagreeing forever, because
// nothing is listening to the `storage` event.
//
// EVERY READ AND WRITE IS WRAPPED. `localStorage` throws in a private window,
// returns nothing after site data is cleared, and is blocked outright by some
// settings. A harness that white-screens on that is worse than one that
// forgets, so the failure path is "use the default" every time.
import { DEFAULT_SCENARIO, type Scenario } from "@/mock/scenario";
import type { MockPlaceProfile } from "@/mock/types";

const KEY = "mesita-mock-business-app:scenario";
const PLACE_KEY = "mesita-mock-business-app:last-place";

const listeners = new Set<() => void>();

// The cache exists for ONE reason: `useSyncExternalStore` compares snapshots by
// identity, so parsing the JSON afresh on every call would hand React a new
// object every time and loop forever. The raw string is the cache key.
let cachedRaw: string | null = null;
let cachedScenario: Scenario = DEFAULT_SCENARIO;
let cachedPlace: string | null = null;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // See the header. The console keeps working; it just forgets.
  }
}

function emit(): void {
  for (const l of listeners) l();
}

export function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab of the same harness. Cheap to support and confusing to omit.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === PLACE_KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getScenario(): Scenario {
  const raw = safeGet(KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedScenario = raw
        ? { ...DEFAULT_SCENARIO, ...(JSON.parse(raw) as Partial<Scenario>) }
        : DEFAULT_SCENARIO;
    } catch {
      // A hand-edited or half-written value. Fall back rather than crash the
      // whole console on a string somebody pasted into devtools.
      cachedScenario = DEFAULT_SCENARIO;
    }
  }
  return cachedScenario;
}

/** The SERVER's snapshot, and the first client render's. It must be the same
 *  object on both sides or hydration mismatches; React re-renders with the real
 *  one immediately after. */
export function getServerScenario(): Scenario {
  return DEFAULT_SCENARIO;
}

export function setScenario(patch: Partial<Scenario>): void {
  const next = { ...getScenario(), ...patch };
  cachedScenario = next;
  cachedRaw = JSON.stringify(next);
  safeSet(KEY, cachedRaw);
  emit();
}

export function resetScenario(): void {
  cachedScenario = DEFAULT_SCENARIO;
  cachedRaw = null;
  safeSet(KEY, null);
  // Reset means "put the world back", and a saved Profile edit is part of the
  // world now — leaving it behind would make Reset a partial promise.
  profileEdits = NO_EDITS;
  emit();
}

export function getLastPlaceId(): string | null {
  cachedPlace = safeGet(PLACE_KEY);
  return cachedPlace;
}

export function getServerLastPlaceId(): null {
  return null;
}

export function rememberPlace(id: string | null): void {
  if (getLastPlaceId() === id) return; // never emit a change that is not one
  cachedPlace = id;
  safeSet(PLACE_KEY, id);
  emit();
}

/** Whether React has hydrated. The server snapshot is false and the client's is
 *  true, so this flips exactly once, without an effect and without state. */
export function getHydrated(): true {
  return true;
}
export function getServerHydrated(): false {
  return false;
}

// ── PROFILE EDITS, AND WHY THEY ARE NOT IN localStorage ─────────────────────
//
// The Profile screen is EDITABLE and its save bar is the whole reason its
// cards are laid out the way they are, so this app's Save has to do something:
// it writes here, and the heading, the completeness meter and the rail all
// re-read from it. A Save that only toggled a "Saved" pill would be the one
// lie a harness must not tell.
//
// IN MEMORY, unlike the scenario one block up, and the reason is the Photos
// card: an uploaded photo becomes a data URI, ten of them is comfortably past
// the ~5MB origin quota, and `safeSet` swallowing that throw would mean an
// edit that silently did not persist — worse than one that obviously did not.
// So these last as long as the tab does. On reload the fixtures are the
// database again, which is what this app promises anyway.
let profileEdits: Record<string, MockPlaceProfile> = {};

/** Frozen empty object: `useSyncExternalStore` compares by identity, so the
 *  server snapshot has to be the same reference every call. */
const NO_EDITS: Record<string, MockPlaceProfile> = Object.freeze({});

export function getProfileEdits(): Record<string, MockPlaceProfile> {
  return profileEdits;
}

export function getServerProfileEdits(): Record<string, MockPlaceProfile> {
  return NO_EDITS;
}

export function saveProfile(placeId: string, profile: MockPlaceProfile): void {
  profileEdits = { ...profileEdits, [placeId]: profile };
  emit();
}
