// Search-bar scope: location centers the map and may bias name search.
// Country is always Any — Autocomplete and Text Search do not take a
// region code. Discovery filters are a different sheet.

export const DEFAULT_SEARCH_COUNTRY = null;

/** Globe for the unset restrict — not a country, still first in the sheet. */
export const ANY_COUNTRY_FLAG = "🌐";

export const SEARCH_COUNTRIES = [
  { code: "MX", label: "Mexico", flag: "🇲🇽" },
  { code: "US", label: "United States", flag: "🇺🇸" },
  { code: "CA", label: "Canada", flag: "🇨🇦" },
  { code: "ES", label: "Spain", flag: "🇪🇸" },
  { code: "AR", label: "Argentina", flag: "🇦🇷" },
  { code: "CL", label: "Chile", flag: "🇨🇱" },
  { code: "CO", label: "Colombia", flag: "🇨🇴" },
  { code: "PE", label: "Peru", flag: "🇵🇪" },
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

export function countryFlag(code: string | null): string {
  if (!code) return ANY_COUNTRY_FLAG;
  return SEARCH_COUNTRIES.find((c) => c.code === code)?.flag ?? "";
}

/** Compact chip / pill: flag + ISO, or globe + Any when unrestricted. */
export function countryChip(code: string | null): string {
  if (!code) return `${ANY_COUNTRY_FLAG} Any`;
  const flag = countryFlag(code);
  return flag ? `${flag} ${code}` : code;
}

/** Search-bar chip: flag + ISO, or the globe alone so Any still fits. */
export function countryBarChip(code: string | null): string {
  if (!code) return ANY_COUNTRY_FLAG;
  return countryChip(code);
}
