// The Scores box on Mesita Business → Profile (MESITA-4515).
//
// Popular Organic, the place screen's ranking. The numbers are the same
// functions Discovery uses. This read does not call Foursquare.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { PREMIER_FACTOR } from "./boost.ts";
import { loadDiscoveryConfig } from "./discovery-config.ts";
import { FAMILIES } from "./place-taxonomy.ts";
import { foursquareBoost, googlePopularity, premierBoost } from "./pipeline-signals.ts";
import { establishedBase, fetchGrowthTerms, growthWeight, type GrowthTerm } from "./review-growth.ts";

export type ScoreRow = {
  label: string;
  value: string;
  detail: string;
  href?: string | null;
};

export type PlaceScoreCard = {
  context: string;
  headline: string;
  rows: ScoreRow[];
};

const KNOWN = FAMILIES.map((family) => family.slug).filter((slug) => slug !== "undefined");

function num(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
}

function times(value: number): string {
  const text = num(value);
  return text.endsWith(".00") ? `${text.slice(0, -3)}×` : `${text}×`;
}

export function explainPlaceScores(input: {
  rating: number | null;
  reviewCount: number | null;
  term: GrowthTerm | undefined;
  foursquarePopularity: number | null;
  foursquareUrl: string | null;
  tier: number;
  googleExp: number;
  foursquareFactor: number;
  foursquareExponent: number;
  premierExp: number;
  history: string;
}): PlaceScoreCard {
  const established = establishedBase(input.rating, input.reviewCount);
  const w = input.term ? growthWeight(input.term.elapsedDays, null, input.term.kind) : 0;
  const lifetime = established > 0 ? Math.pow(established, input.googleExp) : 0;
  const recentBase = input.term && (input.term.kind === "grow" || input.term.kind === "flat")
    ? Math.max(0, input.term.growthBase ?? 0)
    : null;
  const recent = recentBase === null ? null : recentBase > 0 ? Math.pow(recentBase, input.googleExp) : 0;
  const google = googlePopularity(
    { rating: input.rating, reviewCount: input.reviewCount },
    input.googleExp,
    input.term,
  );
  const boost = foursquareBoost(input.foursquarePopularity, input.foursquareFactor, input.foursquareExponent);
  const factor = input.tier === 2 ? PREMIER_FACTOR[2] : input.tier === 1 ? PREMIER_FACTOR[1] : 1;
  const effective = premierBoost(factor, input.premierExp);
  const plan = input.tier === 2 ? "5X" : input.tier === 1 ? "2X" : "No plan";
  const stars = typeof input.rating === "number" ? num(input.rating) : "—";
  const reviews = typeof input.reviewCount === "number" ? String(Math.round(input.reviewCount)) : "—";
  const raw = input.foursquarePopularity;
  return {
    context: "Popular Organic · the place screen's ranking",
    headline: "Mesita popularity = Google popularity × Foursquare boost",
    rows: [
      {
        label: "Mesita popularity",
        value: num(google * boost),
        detail: "Premier and distance are not in this number.",
      },
      {
        label: "Google recent popularity",
        value: recent === null ? "—" : num(recent),
        detail: input.history,
      },
      {
        label: "Google lifetime popularity",
        value: num(lifetime),
        detail: `${reviews} reviews · ${stars} stars`,
      },
      {
        label: "Google popularity",
        value: num(google),
        detail: `recent ${Math.round(w * 100)}% · lifetime ${Math.round((1 - w) * 100)}%`,
      },
      {
        label: "Foursquare popularity",
        value: raw === null ? "Unavailable" : num(raw),
        detail: raw === null ? "Unavailable · 1×" : `${times(boost)}`,
        href: input.foursquareUrl,
      },
      {
        label: "Premier boost",
        value: times(effective),
        detail: effective === 1 && factor !== 1
          ? `Your plan is ${plan}. Popular Organic uses Premier exponent 0, so this lane applies 1×.`
          : `Your plan is ${plan}. This lane applies ${times(effective)}.`,
      },
      {
        label: "Distance",
        value: "—",
        detail: "Distance depends on the guest's location.",
      },
    ],
  };
}

function historySentence(
  rows: { observed_at: string; review_count: number }[] | null,
  term: GrowthTerm | undefined,
): string {
  if (!term || term.kind === "missing" || term.kind === "short") return "Collecting history.";
  if (term.kind === "fallback") return "Not enough nearby places to measure growth yet.";
  if (!rows || rows.length < 2) return "Collecting history.";
  const first = rows[0];
  const last = rows[rows.length - 1];
  const elapsed = (new Date(last.observed_at).getTime() - new Date(first.observed_at).getTime()) / 86_400_000;
  if (!(elapsed > 0)) return "Collecting history.";
  const delta = last.review_count - first.review_count;
  const perDay = delta / elapsed;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} reviews in ${Math.max(1, Math.round(elapsed))} days · ${num(perDay)}/day.`;
}

/** The card for one place. A failed growth read still returns the lifetime score. */
export async function loadPlaceScores(admin: SupabaseClient, placeId: string): Promise<PlaceScoreCard | null> {
  const { data, error } = await admin
    .from("place_profiles")
    .select("google_stars_overall, google_review_count, google_place_id, foursquare_popularity, foursquare_url")
    .eq("id", placeId)
    .maybeSingle();
  if (error || !data) return null;
  const tierRow = await admin.from("places").select("boost_tier").eq("id", placeId).maybeSingle();
  const cfg = await loadDiscoveryConfig(admin);
  const recipe = cfg.params.recipes.catalogPopularOrganic;
  const terms = await fetchGrowthTerms(
    (args) => admin.rpc("discovery_growth_bases", args),
    cfg.general.requireActive === true,
    KNOWN,
  );
  const term = terms.get(placeId);
  let observations: { observed_at: string; review_count: number }[] | null = null;
  const googleId = (data as { google_place_id?: string | null }).google_place_id;
  if (googleId) {
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const obs = await admin
      .from("google_review_observations")
      .select("observed_at, review_count")
      .eq("place_id", placeId)
      .eq("google_place_id", googleId)
      .gte("observed_at", since)
      .order("observed_at", { ascending: true });
    if (!obs.error && Array.isArray(obs.data)) {
      observations = obs.data as { observed_at: string; review_count: number }[];
    }
  }
  const row = data as {
    google_stars_overall: number | null;
    google_review_count: number | null;
    foursquare_popularity: number | null;
    foursquare_url: string | null;
  };
  return explainPlaceScores({
    rating: row.google_stars_overall,
    reviewCount: row.google_review_count,
    term,
    foursquarePopularity: row.foursquare_popularity,
    foursquareUrl: row.foursquare_url,
    tier: typeof tierRow.data?.boost_tier === "number" ? tierRow.data.boost_tier : 0,
    googleExp: recipe.googleExp,
    foursquareFactor: recipe.foursquareFactor,
    foursquareExponent: recipe.foursquareExponent,
    premierExp: recipe.premierExp,
    history: historySentence(observations, term),
  });
}
