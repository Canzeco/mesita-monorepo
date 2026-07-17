export type Region = "mx_latam" | "us" | "other";

export const LATAM_COUNTRIES = new Set([
  "mexico",
  "argentina",
  "colombia",
  "chile",
  "peru",
  "uruguay",
  "brazil",
  "ecuador",
  "bolivia",
  "paraguay",
  "venezuela",
  "guatemala",
  "costa rica",
  "panama",
  "dominican republic",
  "el salvador",
  "honduras",
  "nicaragua",
  "puerto rico",
]);

export function regionForCountry(country: string | null): Region {
  if (!country) return "other";
  const c = country.toLowerCase();
  if (c === "united states" || c === "us" || c === "canada" || c === "ca") {
    return "us";
  }
  if (LATAM_COUNTRIES.has(c)) return "mx_latam";
  return "other";
}
