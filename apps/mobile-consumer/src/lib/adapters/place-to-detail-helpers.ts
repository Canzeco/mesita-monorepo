import type { PlaceDetail } from '@/lib/types/place-detail';

export type Row = Record<string, unknown>;

export function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}

export function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function arr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function neighborhoodFromAddress(
  address: string | undefined,
): string | undefined {
  if (!address) return undefined;
  const match = address.match(/,\s*([^,]+?),\s*\d{5}\s/);
  const candidate = match?.[1]?.trim();
  if (!candidate || /\d/.test(candidate)) return undefined;
  return candidate;
}

// City fallback when zone + colonia are missing. Keep in sync with web
// `apps/web-consumer/src/lib/adapters/place-to-detail.ts`.
export function cityFromAddress(
  address: string | undefined,
): string | null {
  if (!address) return null;
  const postCodeCityMatch = address.match(/\d{5}\s+([^,]+)/);
  const direct = postCodeCityMatch?.[1]?.trim();
  if (direct && !/\d/.test(direct)) return direct;

  const parts = address
    .split(',')
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
  const fromNeighborhood = neighborhoodFromAddress(
    input.address ?? undefined,
  );
  if (fromNeighborhood) return fromNeighborhood;
  return cityFromAddress(input.address ?? undefined);
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const DAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const WEEK_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function parseMinutes(t: unknown): number | null {
  if (typeof t !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function currencyPrefix(code: string): string {
  if (code === 'MXN') return 'MX$';
  if (code === 'USD') return '$';
  if (code === 'EUR') return '€';
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
  if (raw && /\d/.test(raw)) return raw;
  return fallbackPriceRange(priceLevel, currency);
}

export function computeOpenState(
  hours: unknown,
  tz: string | undefined,
): { open_now: boolean; opens_at: string; closes_at: string } {
  const fallback = { open_now: false, opens_at: '', closes_at: '' };
  const h = obj(hours);
  if (Object.keys(h).length === 0) return fallback;
  let dayIdx: number;
  let nowMin: number;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz || 'UTC',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const wd = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const hr = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const mn = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
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

  const todayKey = WEEK_KEYS[dayIdx];
  const yKey = WEEK_KEYS[(dayIdx + 6) % 7];

  for (const r of arr<{ open?: string; close?: string }>(h[yKey])) {
    const o = parseMinutes(r.open);
    const c = parseMinutes(r.close);
    if (o == null || c == null) continue;
    if (c <= o && nowMin < c) {
      return { open_now: true, opens_at: '', closes_at: r.close ?? '' };
    }
  }

  let nextOpen: { min: number; at: string } | null = null;
  for (const r of arr<{ open?: string; close?: string }>(h[todayKey])) {
    const o = parseMinutes(r.open);
    const c = parseMinutes(r.close);
    if (o == null || c == null) continue;
    const within = c > o ? nowMin >= o && nowMin < c : nowMin >= o;
    if (within) {
      return { open_now: true, opens_at: '', closes_at: r.close ?? '' };
    }
    if (o > nowMin && (!nextOpen || o < nextOpen.min)) {
      nextOpen = { min: o, at: r.open ?? '' };
    }
  }
  if (nextOpen)
    return { open_now: false, opens_at: nextOpen.at, closes_at: '' };

  for (let i = 1; i <= 7; i += 1) {
    const k = WEEK_KEYS[(dayIdx + i) % 7];
    const ranges = arr<{ open?: string }>(h[k]);
    if (ranges.length > 0 && ranges[0].open) {
      return { open_now: false, opens_at: ranges[0].open, closes_at: '' };
    }
  }
  return fallback;
}

export function hoursTable(hours: unknown): PlaceDetail['hours_table'] {
  const h = obj(hours);
  const out: PlaceDetail['hours_table'] = [];
  for (const day of DAY_ORDER) {
    const ranges = arr<{ open?: string; close?: string }>(h[day]);
    if (ranges.length === 0) {
      out.push({ day: DAY_LABELS[day], range: 'Closed' });
      continue;
    }
    const label = ranges
      .map((r) => `${r.open ?? ''}–${r.close ?? ''}`)
      .join(', ');
    out.push({ day: DAY_LABELS[day], range: label });
  }
  return out;
}
