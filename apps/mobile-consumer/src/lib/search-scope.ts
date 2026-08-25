// Search-bar scope — port of apps/web-consumer/src/lib/search-scope.ts.

export const DEFAULT_SEARCH_COUNTRY = 'MX';

export const SEARCH_COUNTRIES = [
  { code: 'MX', label: 'Mexico' },
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'ES', label: 'Spain' },
  { code: 'AR', label: 'Argentina' },
  { code: 'CL', label: 'Chile' },
  { code: 'CO', label: 'Colombia' },
  { code: 'PE', label: 'Peru' },
] as const;

const COUNTRY_KEY = 'mesita.search.country';
const LOCATION_OPTOUT_KEY = 'mesita.search.locationOptOut';

export function parseSearchCountry(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const code = trimmed.toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredSearchCountry(): string | null {
  const raw = storage()?.getItem(COUNTRY_KEY);
  if (raw === null || raw === undefined) return DEFAULT_SEARCH_COUNTRY;
  return parseSearchCountry(raw);
}

export function writeStoredSearchCountry(code: string | null): void {
  storage()?.setItem(COUNTRY_KEY, code ?? '');
}

export function readStoredLocationOptOut(): boolean {
  return storage()?.getItem(LOCATION_OPTOUT_KEY) === '1';
}

export function writeStoredLocationOptOut(optOut: boolean): void {
  const store = storage();
  if (!store) return;
  if (optOut) store.setItem(LOCATION_OPTOUT_KEY, '1');
  else store.removeItem(LOCATION_OPTOUT_KEY);
}

export function countryLabel(code: string | null): string {
  if (!code) return 'Any';
  return SEARCH_COUNTRIES.find((c) => c.code === code)?.label ?? code;
}
