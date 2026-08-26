// Search-bar scope — port of apps/web-consumer/src/lib/search-scope.ts.
// Persistence is AsyncStorage (native); web uses localStorage.

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

export const SEARCH_COUNTRY_KEY = 'mesita.search.country';
export const SEARCH_LOCATION_OPTOUT_KEY = 'mesita.search.locationOptOut';

export function parseSearchCountry(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const code = trimmed.toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export function countryLabel(code: string | null): string {
  if (!code) return 'Any';
  return SEARCH_COUNTRIES.find((c) => c.code === code)?.label ?? code;
}
