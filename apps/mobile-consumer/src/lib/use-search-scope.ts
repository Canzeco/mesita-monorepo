import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useSyncExternalStore } from 'react';

import {
  DEFAULT_SEARCH_COUNTRY,
  SEARCH_COUNTRY_KEY,
  SEARCH_LOCATION_OPTOUT_KEY,
  parseSearchCountry,
} from '@/lib/search-scope';

type ScopeState = {
  country: string | null;
  locationOptOut: boolean;
};

let state: ScopeState = {
  country: DEFAULT_SEARCH_COUNTRY,
  locationOptOut: false,
};
let hydrated = false;
let hydrating: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const [countryRaw, optOutRaw] = await Promise.all([
        AsyncStorage.getItem(SEARCH_COUNTRY_KEY),
        AsyncStorage.getItem(SEARCH_LOCATION_OPTOUT_KEY),
      ]);
      if (countryRaw !== null) state = { ...state, country: parseSearchCountry(countryRaw) };
      if (optOutRaw !== null) {
        state = { ...state, locationOptOut: optOutRaw === '1' };
      }
    } catch {
      /* degrade silently */
    } finally {
      hydrated = true;
      hydrating = null;
      emit();
    }
  })();
  return hydrating;
}

function persist() {
  void Promise.all([
    AsyncStorage.setItem(SEARCH_COUNTRY_KEY, state.country ?? ''),
    state.locationOptOut
      ? AsyncStorage.setItem(SEARCH_LOCATION_OPTOUT_KEY, '1')
      : AsyncStorage.removeItem(SEARCH_LOCATION_OPTOUT_KEY),
  ]).catch(() => undefined);
}

function subscribe(listener: () => void): () => void {
  void hydrate();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSearchScope() {
  const snap = useSyncExternalStore(subscribe, () => state, () => state);

  const setCountry = useCallback((next: string | null) => {
    void hydrate().then(() => {
      state = { ...state, country: next };
      persist();
      emit();
    });
  }, []);

  const setLocationOptOut = useCallback((next: boolean) => {
    void hydrate().then(() => {
      state = { ...state, locationOptOut: next };
      persist();
      emit();
    });
  }, []);

  return {
    country: snap.country,
    locationOptOut: snap.locationOptOut,
    setCountry,
    setLocationOptOut,
  };
}
