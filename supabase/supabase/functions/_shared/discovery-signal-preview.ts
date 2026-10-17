// Example inputs for the admin signal graphics.
// Every number comes from the live signal function. This file does not
// restate the curve.

import { catalogAdmitted, placeBelongsToFamily } from "./catalog-rank.ts";
import {
  category,
  enriched,
  name,
  popularity,
  proximity,
  randomness,
  type SignalIntent,
  type SignalParamBag,
  type SignalPlace,
  timing,
} from "./discovery-signals.ts";
import { haversineKm } from "./geo.ts";

export type PreviewRow = {
  label: string;
  score: number;
  note: string;
};

export type PreviewCurvePoint = { km: number; score: number };

const GUEST = { lat: 19.4326, lng: -99.1332 };
const NOON = new Date("2026-08-19T19:00:00Z");

const OPEN_ALL_DAY = {
  monday: [{ open: "00:00", close: "23:59" }],
  tuesday: [{ open: "00:00", close: "23:59" }],
  wednesday: [{ open: "00:00", close: "23:59" }],
  thursday: [{ open: "00:00", close: "23:59" }],
  friday: [{ open: "00:00", close: "23:59" }],
  saturday: [{ open: "00:00", close: "23:59" }],
  sunday: [{ open: "00:00", close: "23:59" }],
};

const CLOSED_AT_NOON = {
  monday: [{ open: "03:00", close: "03:30" }],
  tuesday: [{ open: "03:00", close: "03:30" }],
  wednesday: [{ open: "03:00", close: "03:30" }],
  thursday: [{ open: "03:00", close: "03:30" }],
  friday: [{ open: "03:00", close: "03:30" }],
  saturday: [{ open: "03:00", close: "03:30" }],
  sunday: [{ open: "03:00", close: "03:30" }],
};

function blank(over: Partial<SignalPlace> = {}): SignalPlace {
  return {
    lat: GUEST.lat,
    lng: GUEST.lng,
    hours: null,
    category: null,
    family_keys: null,
    rating: null,
    user_ratings_total: null,
    embedding: null,
    ...over,
  };
}

function northOf(km: number): number {
  if (km <= 0) return GUEST.lat;
  let lo = GUEST.lat;
  let hi = GUEST.lat + km / 80 + 0.01;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (haversineKm(GUEST.lat, GUEST.lng, mid, GUEST.lng) < km) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function previewProximity(
  maxKm: number,
  samplesKm: number[],
): { rows: PreviewRow[]; curve: PreviewCurvePoint[] } {
  const params: SignalParamBag = { maxKm };
  const curve = samplesKm.map((km) => {
    const lat = northOf(km);
    const score = proximity(
      blank({ lat, lng: GUEST.lng }),
      GUEST,
      params,
    );
    const seen = haversineKm(GUEST.lat, GUEST.lng, lat, GUEST.lng);
    return { km: Math.round(seen * 10) / 10, score };
  });
  const rows: PreviewRow[] = [
    {
      label: "Beside the guest",
      score: proximity(blank(), GUEST, params),
      note: "Same coordinates.",
    },
    {
      label: "No guest location",
      score: proximity(blank(), {}, params),
      note: "Every place scores the same.",
    },
    {
      label: "Place has no coordinates",
      score: proximity(blank({ lat: null, lng: null }), GUEST, params),
      note: "The place cannot be placed.",
    },
  ];
  return { rows, curve };
}

export function previewTiming(closedFloor: number): PreviewRow[] {
  const params: SignalParamBag = { closedFloor };
  const intent: SignalIntent = { now: NOON };
  return [
    {
      label: "Open at noon",
      score: timing(blank({ hours: OPEN_ALL_DAY }), intent, params),
      note: "The door is open.",
    },
    {
      label: "Closed at noon",
      score: timing(blank({ hours: CLOSED_AT_NOON }), intent, params),
      note: "Pushed down to the closed floor. Not removed.",
    },
    {
      label: "Hours unknown",
      score: timing(blank({ hours: null }), intent, params),
      note: "No hours to read, so the open half does not guess.",
    },
  ];
}

export function previewFamily(
  asked: string,
  places: { label: string; family: string | null }[],
): PreviewRow[] {
  return places.map((place) => {
    const keys = place.family ? [place.family] : [];
    const score = category(
      blank({ family_keys: keys, category: place.family }),
      { families: [asked] },
    );
    const inside = placeBelongsToFamily(keys, asked);
    return {
      label: place.label,
      score,
      note: inside ? `In ${asked}.` : `Not in ${asked}.`,
    };
  });
}

export function previewPopularity(
  places: { label: string; rating: number | null; reviews: number }[],
): PreviewRow[] {
  return places.map((place) => ({
    label: place.label,
    score: popularity(blank({
      rating: place.rating,
      user_ratings_total: place.reviews,
    })),
    note: place.rating == null
      ? "No rating."
      : `${place.rating} from ${place.reviews} reviews.`,
  }));
}

export function previewEnrichment(
  places: { label: string; enriched: boolean; ready: boolean }[],
): PreviewRow[] {
  return places.map((place) => {
    const admitted = catalogAdmitted({
      enriched_at: place.enriched ? "2026-01-01T00:00:00Z" : null,
      content_state: place.ready ? "ready" : "pending",
    });
    return {
      label: place.label,
      score: enriched(blank({ enriched: place.enriched && place.ready })),
      note: admitted ? "Admitted." : "Held out.",
    };
  });
}

export function previewRandomness(seed: number, count: number): PreviewRow[] {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  return Array.from({ length: count }, (_, i) => ({
    label: `Draw ${i + 1}`,
    score: randomness(blank(), { random }),
    note: "A fresh draw. It reads nothing about the place.",
  }));
}

export function previewName(
  query: number[] | null,
  places: { label: string; vector: number[] | null }[],
): PreviewRow[] {
  return places.map((place) => ({
    label: place.label,
    score: name(blank({ nameEmbedding: place.vector ?? undefined }), {
      queryNameVector: query,
    }),
    note: query == null
      ? "No query. Every place scores the same."
      : place.vector == null
      ? "This place has no name of its own."
      : "Relevance against the query.",
  }));
}
