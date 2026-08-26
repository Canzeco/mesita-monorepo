// Search-bar scope: country limits Google Autocomplete + Text Search;
// location centers the map and biases those calls. Both optional.
// Discovery filters (cuisine, when, rewards) are a different sheet.

export const DEFAULT_SEARCH_COUNTRY = "MX";

export const SEARCH_COUNTRIES = [
  { code: "MX", label: "Mexico" },
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "ES", label: "Spain" },
  { code: "AR", label: "Argentina" },
  { code: "CL", label: "Chile" },
  { code: "CO", label: "Colombia" },
  { code: "PE", label: "Peru" },
] as const;

const COUNTRY_KEY = "mesita.search.country";
const LOCATION_OPTOUT_KEY = "mesita.search.locationOptOut";

/** ISO-3166-1 alpha-2, or null when the guest cleared the restrict. */
export function parseSearchCountry(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const code = trimmed.toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export function readStoredSearchCountry(): string | null {
  if (typeof window === "undefined") return DEFAULT_SEARCH_COUNTRY;
  try {
    const raw = window.localStorage.getItem(COUNTRY_KEY);
    if (raw === null) return DEFAULT_SEARCH_COUNTRY;
    return parseSearchCountry(raw);
  } catch {
    return DEFAULT_SEARCH_COUNTRY;
  }
}

export function writeStoredSearchCountry(code: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COUNTRY_KEY, code ?? "");
  } catch {
    /* private mode */
  }
}

export function readStoredLocationOptOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LOCATION_OPTOUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeStoredLocationOptOut(optOut: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (optOut) window.localStorage.setItem(LOCATION_OPTOUT_KEY, "1");
    else window.localStorage.removeItem(LOCATION_OPTOUT_KEY);
  } catch {
    /* private mode */
  }
}

export function countryLabel(code: string | null): string {
  if (!code) return "Any";
  return SEARCH_COUNTRIES.find((c) => c.code === code)?.label ?? code;
}
