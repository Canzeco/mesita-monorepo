import type { PlaceDetail, PlaceDetailTag } from '@/lib/types/place-detail';

type Row = Record<string, unknown>;

export type ResolvedTag = {
  slug: string;
  label_es: string;
  label_en: string;
  facet: string;
  section: string;
  sort_order: number;
};

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function currencyPrefix(code: string): string {
  if (code === 'MXN') return 'MX$';
  if (code === 'USD') return '$';
  if (code === 'EUR') return '€';
  return `${code} `;
}

function fallbackPriceRange(level: number, currency: string): string | null {
  if (level < 1 || level > 4) return null;
  const ranges: Record<number, [number, number]> = {
    1: [100, 200],
    2: [200, 300],
    3: [300, 500],
    4: [500, 800],
  };
  const [min, max] = ranges[Math.round(level)]!;
  return `${currencyPrefix(currency)}${min}–${max}`;
}

/** Map consumer-web-get-place row (+ tags) → lean mobile PlaceDetail. */
export function placeRowToDetail(
  row: Row,
  tags: ResolvedTag[] = [],
): PlaceDetail {
  const currency = str(row.currency) ?? 'MXN';
  const priceLevel = num(row.price_level);
  const priceRangeRaw = str(row.price_range);
  const price_range =
    priceRangeRaw && /\d/.test(priceRangeRaw)
      ? priceRangeRaw
      : priceLevel != null
        ? fallbackPriceRange(priceLevel, currency)
        : null;

  const photos = arr(row.photos).filter(
    (p): p is string => typeof p === 'string' && p.startsWith('https://'),
  );

  const mappedTags: PlaceDetailTag[] = tags.map((t) => ({
    slug: t.slug,
    label: t.label_es || t.label_en,
    facet: t.facet,
  }));

  const listing =
    row.listing_type === 'partner' || row.listing_type === 'web'
      ? row.listing_type
      : 'web';

  return {
    id: String(row.id ?? ''),
    slug: str(row.slug) ?? String(row.id ?? ''),
    name: str(row.name) ?? 'Place',
    category: str(row.category_label) ?? str(row.category) ?? '',
    vibe: str(row.vibe) ?? '',
    price_level: priceLevel,
    price_range,
    currency,
    address: str(row.address) ?? '',
    zone: str(row.zone),
    lat: num(row.lat),
    lng: num(row.lng),
    listing_type: listing,
    open_now: typeof row.open_now === 'boolean' ? row.open_now : null,
    opens_at: str(row.opens_at),
    closes_at: str(row.closes_at),
    photos,
    pitch: str(row.pitch),
    story: str(row.story),
    phone: str(row.phone),
    website_url: str(row.website_url),
    instagram_url: str(row.instagram_url),
    google_maps_url: str(row.google_maps_url),
    whatsapp_url: str(row.whatsapp_url),
    google_rating: num(row.google_rating),
    google_count: num(row.google_count),
    instagram_followers: num(row.instagram_followers_count),
    tags: mappedTags,
    welcome_free_rate: num(row.welcome_free_rate),
    welcome_premium_rate: num(row.welcome_premium_rate),
    free_rate: num(row.free_rate),
    premium_rate: num(row.premium_rate),
    is_first_visit:
      typeof row.is_first_visit === 'boolean' ? row.is_first_visit : null,
  };
}
