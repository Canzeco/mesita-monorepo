// May this guest add this Google place to Mesita? (MESITA-4681, Pato
// 2026-11-22). One answer for the Generate preview and for the create, so the
// preview never offers Generate when the create would refuse:
//   - an anonymous visitor never adds a place ("ANONYMOUS USERS CANNOT ADD
//     PLACES TO MESITA");
//   - the place needs Creation's minimum Google reviews (consumer app only);
//   - its main Google category must be allowed by Atlas, unless Creation's
//     universal switch allows any;
//   - a guest adds at most Creation's places per calendar month (Mexico City),
//     counted as `created` opens in place_open_events.
// The preview still shows a place that fails; only Generate is off.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { EnrichmentConfig } from "./enrichment-config.ts";
import type { PlacePreview } from "./google-places.ts";
import { loadDiscoveryConfig } from "./discovery-config.ts";
import { evaluatePlaceForMap } from "./map-engine.ts";
import { mainGoogleCategoryOnMesita } from "./categories.ts";
import { googleTypesPrimaryFirst } from "./google-table-b.ts";

export type AddRefusal =
  | "sign_in"
  | "below_min_reviews"
  | "category_not_on_mesita"
  | "monthly_limit"
  /** Discovery's place rules (rating and popularity floors), as Create applies them. */
  | "place_rules";

export type AddVerdict = {
  canAdd: boolean;
  code: AddRefusal | null;
  /** One line the dialog shows under the title. */
  message: string;
  /** The guest's month: null for an anonymous visitor. */
  monthly: { limit: number; used: number } | null;
};

type Gates = Pick<
  EnrichmentConfig,
  "enrichConsumerMinGoogleReviews" | "enrichConsumerCreatesPerMonth" | "enrichAllowAnyGoogleCategory"
>;

/** Pure: the verdict from facts already read. Order: who, then the place, then the month. */
export function addVerdict(input: {
  signedIn: boolean;
  reviewCount: number | null;
  categoryAllowed: boolean;
  /** Discovery's floors refused the place (Create's Map gate); its words. */
  placeRulesRefusal?: string | null;
  usedThisMonth: number;
  config: Gates;
}): AddVerdict {
  const { config } = input;
  const limit = config.enrichConsumerCreatesPerMonth;
  const monthly = input.signedIn ? { limit, used: input.usedThisMonth } : null;
  const refuse = (code: AddRefusal, message: string): AddVerdict => ({
    canAdd: false,
    code,
    message,
    monthly,
  });
  if (!input.signedIn) return refuse("sign_in", "Sign in to add places to Mesita.");
  const min = config.enrichConsumerMinGoogleReviews;
  if (min > 0 && (input.reviewCount ?? 0) < min) {
    return refuse(
      "below_min_reviews",
      `Mesita adds places with at least ${min} Google reviews.`,
    );
  }
  if (!config.enrichAllowAnyGoogleCategory && !input.categoryAllowed) {
    return refuse("category_not_on_mesita", "This kind of place isn't on Mesita.");
  }
  if (input.placeRulesRefusal) return refuse("place_rules", input.placeRulesRefusal);
  if (input.usedThisMonth >= limit) {
    return refuse(
      "monthly_limit",
      `You've added your ${limit} places this month. More next month.`,
    );
  }
  const left = limit - input.usedThisMonth;
  return {
    canAdd: true,
    code: null,
    message: `You can add ${limit} places a month to Mesita · ${left} left.`,
    monthly,
  };
}

/** The first instant of this calendar month in Mexico City (UTC-6, no DST since 2022). */
export function monthStartMexicoCity(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1, 6)).toISOString();
}

/** Places this guest added this month. A failed read counts as the limit: fail closed. */
export async function placesAddedThisMonth(
  admin: SupabaseClient,
  consumerId: string,
  limit: number,
): Promise<number> {
  const { count, error } = await admin
    .from("place_open_events")
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", consumerId)
    .eq("outcome", "created")
    .gte("created_at", monthStartMexicoCity());
  if (error || count === null) return limit;
  return count;
}

/**
 * The Generate preview's verdict: every gate Create will apply to this guest
 * and this place, from the Details the preview already read. `consumerId`
 * null is an anonymous visitor.
 */
export async function previewAddVerdict(
  admin: SupabaseClient,
  consumerId: string | null,
  preview: PlacePreview,
  config: EnrichmentConfig,
): Promise<AddVerdict> {
  if (!consumerId) {
    return addVerdict({ signedIn: false, reviewCount: null, categoryAllowed: false, usedThisMonth: 0, config });
  }
  const anyType = config.enrichAllowAnyGoogleCategory;
  const [map, main, used] = await Promise.all([
    loadDiscoveryConfig(admin).then((c) => c.map),
    anyType
      ? Promise.resolve({ enabled: true })
      : mainGoogleCategoryOnMesita(admin, googleTypesPrimaryFirst(preview.primaryType, preview.types)),
    placesAddedThisMonth(admin, consumerId, config.enrichConsumerCreatesPerMonth),
  ]);
  const rules = evaluatePlaceForMap(map, {
    primaryType: preview.primaryType,
    rating: preview.rating,
    reviewCount: preview.reviewCount,
  }, { anyType });
  // The type rule reads as the category refusal; the floors keep their words.
  const typeRefused = !rules.eligible && rules.code === "family_not_eligible";
  return addVerdict({
    signedIn: true,
    reviewCount: preview.reviewCount,
    categoryAllowed: main.enabled && !typeRefused,
    placeRulesRefusal: rules.eligible || typeRefused ? null : rules.reason,
    usedThisMonth: used,
    config,
  });
}
