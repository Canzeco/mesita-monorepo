import type { PlaceDetail } from "@/lib/mock/place";

// Loose row type — the EF returns the full place projection; helpers read it
// defensively because enrichment leaves many columns empty.
export type Row = Record<string, unknown>;

export function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

export function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function arr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

// Best-effort neighborhood (colonia) pulled from a Mexican-style formatted
// address — "Street, Colonia, NNNNN City, State" — by grabbing the segment
// immediately before the 5-digit postal code. Any candidate containing a
// digit is rejected, which filters out the street/building lines that
// sometimes sit there ("Av Lázaro Cárdenas 2400-Piso 2"). US-style
// addresses carry no colonia and yield undefined so callers fall back to
// city. Heuristic by design — a clean value or nothing, never garbage.
// Shared so the card (enrich-overview) and the detail page derive the
// same neighborhood.
export function neighborhoodFromAddress(
  address: string | undefined,
): string | undefined {
  if (!address) return undefined;
  const match = address.match(/,\s*([^,]+?),\s*\d{5}\s/);
  const candidate = match?.[1]?.trim();
  if (!candidate || /\d/.test(candidate)) return undefined;
  return candidate;
}

// City fallback when zone + colonia are missing. Parses MX-style
// "…. 64000 Monterrey," or the penultimate comma segment. Shared with the
// swipe card zone label so card + detail stay aligned.
function cityFromAddress(
  address: string | undefined,
): string | null {
  if (!address) return null;
  const postCodeCityMatch = address.match(/\d{5}\s+([^,]+)/);
  const direct = postCodeCityMatch?.[1]?.trim();
  if (direct && !/\d/.test(direct)) return direct;

  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const fallback = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  if (!fallback || /\d/.test(fallback)) return null;
  return fallback;
}

/** Zone chip: prefer explicit zone, else colonia, else city from address. */
export function resolveZoneLabel(input: {
  zone?: string | null;
  address?: string | null;
}): string | null {
  if (input.zone && input.zone.trim().length > 0) return input.zone;
  const fromNeighborhood = neighborhoodFromAddress(input.address ?? undefined);
  if (fromNeighborhood) return fromNeighborhood;
  return cityFromAddress(input.address ?? undefined);
}

const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// Week keyed Sunday-first to match JS getDay() and let us reach "yesterday"
// for overnight ranges that started the day before.
const WEEK_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function parseMinutes(t: unknown): number | null {
  if (typeof t !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function currencyPrefix(code: string): string {
  if (code === "MXN") return "MX$";
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  return `${code} `;
}

function fallbackPriceRange(
  priceLevel: 1 | 2 | 3 | 4,
  currency: string,
): string {
  const prefix = currencyPrefix(currency);
  const ranges: Record<1 | 2 | 3 | 4, [number, number]> = {
    1: [100, 200],
    2: [200, 300],
    3: [300, 500],
    4: [500, 800],
  };
  const [min, max] = ranges[priceLevel];
  return `${prefix}${min}-${max}`;
}

export function derivePriceRange(
  row: Row,
  priceLevel: 1 | 2 | 3 | 4,
  currency: string,
): string {
  const raw = str(row.price_range);
  // Keep explicit numeric ranges from the backend when present.
  if (raw && /\d/.test(raw)) return raw;
  return fallbackPriceRange(priceLevel, currency);
}

// Derives live open/closed state from the weekly `hours` jsonb in the place's
// IANA timezone. Handles split shifts and overnight ranges (close <= open =>
// closes the next day). Falls back to closed/empty when hours or tz are
// missing/unparseable — never throws.
//
// Exported so the deck/catalog card deriver (lib/mock/enrich-overview.ts)
// computes open/closed exactly the same way as the detail modal — one
// implementation, card + detail always agree.
export function computeOpenState(
  hours: unknown,
  tz: string | undefined,
  // Optional place-local minutes-since-midnight override (MESITA-650): the
  // discovery filters ask "open at hour H today?" with the SAME split-shift
  // and overnight math. Omitted = evaluate at the current moment.
  atMinutes?: number,
  // Optional weekday override, 0=Sun..6=Sat (MESITA-672): the "When → at" filter
  // asks "open at hour H on THIS weekday?" (e.g. Saturday at noon). Omitted =
  // the current place-local weekday.
  atDayIdx?: number,
): { open_now: boolean; opens_at: string; closes_at: string } {
  const fallback = { open_now: false, opens_at: "", closes_at: "" };
  const h = obj(hours);
  if (Object.keys(h).length === 0) return fallback;
  let dayIdx: number;
  let nowMin: number;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz || "UTC",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hr = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const mn = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const wdMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    dayIdx = wdMap[wd] ?? 0;
    nowMin = hr * 60 + mn;
  } catch {
    return fallback;
  }
  if (atMinutes != null && Number.isFinite(atMinutes)) {
    nowMin = Math.min(Math.max(Math.round(atMinutes), 0), 24 * 60 - 1);
  }
  if (atDayIdx != null && Number.isFinite(atDayIdx)) {
    dayIdx = ((Math.round(atDayIdx) % 7) + 7) % 7;
  }

  const todayKey = WEEK_KEYS[dayIdx];
  const yKey = WEEK_KEYS[(dayIdx + 6) % 7];

  // Yesterday's overnight range still in progress this morning.
  for (const r of arr<{ open?: string; close?: string }>(h[yKey])) {
    const o = parseMinutes(r.open);
    const c = parseMinutes(r.close);
    if (o == null || c == null) continue;
    if (c <= o && nowMin < c) {
      return { open_now: true, opens_at: "", closes_at: r.close ?? "" };
    }
  }

  let nextOpen: { min: number; at: string } | null = null;
  for (const r of arr<{ open?: string; close?: string }>(h[todayKey])) {
    const o = parseMinutes(r.open);
    const c = parseMinutes(r.close);
    if (o == null || c == null) continue;
    const within = c > o ? nowMin >= o && nowMin < c : nowMin >= o; // overnight
    if (within) {
      return { open_now: true, opens_at: "", closes_at: r.close ?? "" };
    }
    if (o > nowMin && (!nextOpen || o < nextOpen.min)) {
      nextOpen = { min: o, at: r.open ?? "" };
    }
  }
  if (nextOpen)
    return { open_now: false, opens_at: nextOpen.at, closes_at: "" };

  // Closed today already — first opening of the next day with any hours.
  for (let i = 1; i <= 7; i += 1) {
    const k = WEEK_KEYS[(dayIdx + i) % 7];
    const ranges = arr<{ open?: string }>(h[k]);
    if (ranges.length > 0 && ranges[0].open) {
      return { open_now: false, opens_at: ranges[0].open, closes_at: "" };
    }
  }
  return fallback;
}

export function hoursTable(hours: unknown): PlaceDetail["hours_table"] {
  const h = obj(hours);
  const out: PlaceDetail["hours_table"] = [];
  for (const day of DAY_ORDER) {
    const ranges = arr<{ open?: string; close?: string }>(h[day]);
    if (ranges.length === 0) {
      out.push({ day: DAY_LABELS[day], range: "Closed" });
      continue;
    }
    const label = ranges
      .map((r) => `${r.open ?? ""}–${r.close ?? ""}`)
      .join(", ");
    out.push({ day: DAY_LABELS[day], range: label });
  }
  return out;
}
