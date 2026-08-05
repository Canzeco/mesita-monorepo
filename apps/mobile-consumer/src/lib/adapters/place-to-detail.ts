// Maps consumer-web-get-place row → rich PlaceDetail (web parity + MESITA-560 menus).

import { detectMenuKind } from '@/lib/menu-url';
import { resolvePlaceCategoryName } from '@/lib/place-category';
import {
  buildPromoMatrixFromRow,
  hasExplicitClassRates,
} from '@/lib/promo-rates';
import type {
  PlaceDetail,
  PlaceMenuItem,
} from '@/lib/types/place-detail';
import { relativeLabel } from '@/lib/utils';
import type { Row } from './place-to-detail-helpers';
import {
  arr,
  computeOpenState,
  derivePriceRange,
  hoursTable,
  neighborhoodFromAddress,
  num,
  obj,
  str,
} from './place-to-detail-helpers';

export {
  computeOpenState,
  neighborhoodFromAddress,
  resolveZoneLabel,
} from './place-to-detail-helpers';

export type ResolvedTag = {
  slug: string;
  label_es: string;
  label_en: string;
  facet: string;
  section: string;
  sort_order: number;
};

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
  const zoneLabel = str(row.zone) ?? neighborhoodFromAddress(str(row.address));
  const popularTimes = arr<Record<string, unknown>>(row.popular_times);

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
    zone: zoneLabel ?? str(row.city) ?? '',
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
    // Privacy-shaped by consumer-web-get-place (MESITA-913): private accounts
    // arrive already anonymized — never rehydrate a real name client-side.
    mesita_visitors: arr<Record<string, unknown>>(row.mesita_visitors).map(
      (v) => ({
        name: str(v.name) ?? 'Anonymous guest',
        handle: str(v.handle) ?? '',
        class_key: ((): PlaceDetail['mesita_visitors'][number]['class_key'] => {
          const k = (str(v.class_key) ?? 'standard').toLowerCase();
          return k === 'premium' || k === 'influencer' || k === 'aura'
            ? k
            : 'standard';
        })(),
        community: str(v.community) ?? '',
        followers: num(v.followers) ?? 0,
        quote: str(v.quote) ?? '',
        food: num(v.food) ?? 0,
        service: num(v.service) ?? 0,
        ambiance: num(v.ambiance) ?? 0,
        value: num(v.value) ?? 0,
        photo_url: str(v.photo_url),
        photo_aspect: undefined,
      }),
    ),
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
    promo_configured: hasExplicitClassRates(row),
    reward_cap_mxn: num(row.monthly_promo_cap) ?? 0,
    requires_story: row.requires_story === true,
    long_description:
      str(row.description) ?? str(row.story) ?? str(row.pitch) ?? '',
    hours_table: hoursTable(row.hours),
    popular_times: popularTimes.map((p) => ({
      day: str(p.day) ?? '',
      range: str(p.range) ?? '',
      bars: arr<number>(p.bars),
    })),
    popular_times_featured: str(popularTimes[0]?.day) ?? '',
    details: {
      category_full: categoryName,
      zone: zoneLabel ?? '',
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
