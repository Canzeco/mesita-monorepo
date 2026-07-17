// Maps consumer-web-get-place row → rich PlaceDetail (web parity + MESITA-560 menus).

import { detectMenuKind } from '@/lib/menu-url';
import { resolvePlaceCategoryName } from '@/lib/place-category';
import {
  buildPromoMatrixFromRow,
  hasExplicitTierRates,
} from '@/lib/promo-rates';
import type {
  PlaceDetail,
  PlaceMenuItem,
} from '@/lib/types/place-detail';
import { relativeLabel } from '@/lib/utils';

type Row = Record<string, unknown>;

export type ResolvedTag = {
  slug: string;
  label_es: string;
  label_en: string;
  facet: string;
  section: string;
  sort_order: number;
};

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
function arr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function obj(v: unknown): Record<string, unknown> {
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

function derivePriceRange(
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

function hoursTable(hours: unknown): PlaceDetail['hours_table'] {
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

function menusFromRow(row: Row): PlaceMenuItem[] {
  const menuItems = arr(obj(row.products).menu);
  const legacyMenus = arr(row.menus);
  const source = menuItems.length > 0 ? menuItems : legacyMenus;
  const fromJson = source
    .map((raw): PlaceMenuItem | null => {
      if (!raw || typeof raw !== 'object') return null;
      const m = raw as Record<string, unknown>;
      const url = str(m.url) ?? str(m.pdf_url) ?? str(m.source_url) ?? '';
      if (!url) return null;
      const kind = detectMenuKind(url);
      const itemPages = arr(m.items).length;
      const pages =
        typeof m.pages === 'number' && Number.isFinite(m.pages)
          ? Math.max(0, Math.round(m.pages))
          : kind === 'image'
            ? Math.max(1, itemPages || 1)
            : itemPages > 0
              ? itemPages
              : null;
      return {
        name: str(m.name) ?? 'Menu',
        url,
        kind,
        pages,
        updated_label: str(m.updated_label) ?? '',
      };
    })
    .filter((m): m is PlaceMenuItem => m != null);

  if (fromJson.length > 0) return fromJson;

  const legacyUrl = str(row.menu_pdf_url);
  if (!legacyUrl) return [];
  const kind = detectMenuKind(legacyUrl);
  return [
    {
      name: str(row.menu_pdf_name) ?? 'Menu',
      url: legacyUrl,
      kind,
      pages: kind === 'image' ? 1 : null,
      updated_label: '',
    },
  ];
}

export function placeRowToDetail(
  row: Row,
  tags?: ResolvedTag[],
): PlaceDetail {
  const categoryName =
    resolvePlaceCategoryName({
      categoryLabel: str(row.category_label),
      category: str(row.category),
    }) ?? 'Place';
  const currency = str(row.currency) ?? 'MXN';
  const priceLevel = (num(row.price_level) ?? 2) as 1 | 2 | 3 | 4;
  const listingType = row.listing_type === 'partner' ? 'partner' : 'web';
  const details = obj(row.details);
  const activePremiumRate = num(row.premium_rate) ?? num(row.free_rate) ?? 0;
  const openState = computeOpenState(row.hours, str(row.timezone));
  const photos = arr<string>(row.photos).filter((p) =>
    typeof p === 'string' ? p.startsWith('https://') : false,
  );
  const menus = menusFromRow(row);

  return {
    id: str(row.id) ?? str(row.slug) ?? '',
    slug: str(row.slug) ?? str(row.id) ?? '',
    name: str(row.name) ?? 'Place',
    category: categoryName,
    vibe: str(row.vibe) ?? '',
    price_level: priceLevel,
    price_range: derivePriceRange(row, priceLevel, currency),
    currency,
    distance_km: num(row.distance_km) ?? 0,
    open_now: openState.open_now,
    opens_at: openState.opens_at,
    closes_at: openState.closes_at || (str(row.closes_at) ?? ''),
    timezone: str(row.timezone) ?? '',
    city: str(row.city) ?? '',
    address: str(row.address) ?? '',
    lat: num(row.lat) ?? null,
    lng: num(row.lng) ?? null,
    zone:
      str(row.zone) ??
      neighborhoodFromAddress(str(row.address)) ??
      str(row.city) ??
      '',
    listing_type: listingType,
    last_updated_label:
      relativeLabel(str(row.enriched_at) ?? str(row.created_at)) ?? 'recently',
    is_enriching:
      row.content_status === 'queued' || row.content_status === 'generating',
    photos,
    tags: arr<ResolvedTag>(tags).map((t) => ({
      slug: t.slug,
      label: t.label_es || t.label_en,
      facet: t.facet,
    })),
    menus,
    mesita_reviews: {
      food: num(row.mesita_stars_food) ?? 0,
      service: num(row.mesita_stars_service) ?? 0,
      ambiance: num(row.mesita_stars_ambience) ?? 0,
      value: num(row.mesita_stars_value) ?? 0,
      overall: num(row.mesita_stars_overall) ?? 0,
      total: num(row.mesita_review_count) ?? 0,
    },
    google: {
      rating: num(row.google_stars_overall) ?? num(row.google_rating) ?? 0,
      count: num(row.google_review_count) ?? num(row.google_count) ?? 0,
    },
    facebook: {
      rating: num(row.facebook_rating) ?? 0,
      followers: num(row.facebook_followers) ?? 0,
    },
    instagram: { followers: num(row.instagram_followers_count) ?? 0 },
    google_reviews: arr<Record<string, unknown>>(row.google_reviews).map(
      (r) => ({
        author: str(r.author) ?? 'Google reviewer',
        rating: num(r.rating) ?? 0,
        quote: str(r.text) ?? str(r.quote) ?? '',
        date: str(r.published) ?? str(r.date) ?? '',
        photo_url: str(r.photo_url),
      }),
    ),
    mesita_visitors: [],
    products: {
      menu: menus.map((m) => ({
        name: m.name,
        pages: m.pages ?? 0,
        updated_label: m.updated_label,
        url: m.url,
      })),
    },
    promo: {
      badge_label:
        listingType === 'partner' ? 'Verified partner' : 'Web listing',
      reward_kind: 'discount',
      reward_value: activePremiumRate,
    },
    promo_matrix: buildPromoMatrixFromRow(row, listingType),
    promo_configured: hasExplicitTierRates(row),
    reward_cap_mxn: num(row.monthly_promo_cap) ?? 0,
    requires_story: row.requires_story === true,
    long_description:
      str(row.description) ?? str(row.story) ?? str(row.pitch) ?? '',
    hours_table: hoursTable(row.hours),
    popular_times: arr<Record<string, unknown>>(row.popular_times).map(
      (p) => ({
        day: str(p.day) ?? '',
        range: str(p.range) ?? '',
        bars: arr<number>(p.bars),
      }),
    ),
    popular_times_featured:
      str(arr<Record<string, unknown>>(row.popular_times)[0]?.day) ?? '',
    details: {
      category_full: categoryName,
      zone: str(row.zone) ?? neighborhoodFromAddress(str(row.address)) ?? '',
      dining_style: str(details.dining_style) ?? '',
      dress_code: str(details.dress_code) ?? '',
      service_options: arr<string>(details.service_options),
      reservations: str(details.reservations) ?? '',
      payment_methods: arr<string>(details.payment_methods),
      parking: str(details.parking) ?? '',
      amenities: arr<string>(details.amenities),
      accessibility: arr<string>(details.accessibility),
      dietary_options: arr<string>(details.dietary_options),
      good_for: arr<string>(details.good_for),
      languages: arr<string>(details.languages),
      kid_friendly:
        typeof details.kid_friendly === 'boolean'
          ? details.kid_friendly
          : undefined,
      pet_friendly:
        typeof details.pet_friendly === 'boolean'
          ? details.pet_friendly
          : undefined,
      established_year: num(row.established_year),
      executive_chef: str(row.executive_chef),
      participation: listingType === 'partner' ? 'Partner' : 'Web listing',
      mechanic: 'Discount',
    },
    channels: {
      website_url: str(row.website_url),
      whatsapp_url: str(row.whatsapp_url),
      instagram_url: str(row.instagram_url),
      facebook_url: str(row.facebook_url),
      x_url: str(row.x_url),
      threads_url: str(row.threads_url),
      reddit_url: str(row.reddit_url),
    },
    reservations: {
      opentable_url: str(row.opentable_url),
      resy_url: str(row.resy_url),
      uber_eats_url: str(row.uber_eats_url),
      didi_food_url: str(row.didi_food_url),
    },
    reviews_maps: {
      google_maps_url: str(row.google_maps_url),
    },
    phone: str(row.phone),
    email: str(row.email),
    welcome_free_rate: num(row.welcome_free_rate) ?? null,
    welcome_premium_rate: num(row.welcome_premium_rate) ?? null,
    free_rate: num(row.free_rate) ?? null,
    premium_rate: num(row.premium_rate) ?? null,
    is_first_visit:
      typeof row.is_first_visit === 'boolean' ? row.is_first_visit : null,
    pitch: str(row.pitch) ?? null,
    story: str(row.story) ?? null,
  };
}
