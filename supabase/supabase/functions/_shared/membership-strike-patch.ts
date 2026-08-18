import { deriveListingType } from "./partner-derivation.ts";

export const PROMO_PAUSE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function buildStrikePatch(
  strikeNumber: number,
  now: Date,
): Record<string, unknown> {
  const iso = now.toISOString();
  const patch: Record<string, unknown> = {
    strike_count: strikeNumber,
    last_strike_at: iso,
  };

  if (strikeNumber === 1) {
    // Warning only. It used to clear the staff WhatsApp ping stamp to force a
    // re-test, but there is no staff channel to re-test — the place works the
    // check page, and its next honored ticket is the only signal that matters.
    // Nothing to patch beyond the count and timestamp above.
  } else if (strikeNumber === 2) {
    patch.promo_paused_until = new Date(now.getTime() + PROMO_PAUSE_MS)
      .toISOString();
  } else {
    // Strike 3: remove paid posture, forfeit fee stamp, keep catalog listing.
    //
    // "Keep catalog listing" means the place stays browsable — it does NOT
    // mean it keeps running rewards. Mesita Partner tracks membership +
    // strategy (MESITA-912), so forfeiting the membership demotes here too;
    // otherwise a struck-out place would keep an openable ticket lane with
    // every rate nulled.
    patch.plan = "free";
    const zeroRates = {
      welcome_free_rate: null,
      welcome_premium_rate: null,
      free_rate: null,
      premium_rate: null,
    };
    patch.welcome_free_rate = null;
    patch.welcome_premium_rate = null;
    patch.free_rate = null;
    patch.premium_rate = null;
    patch.monthly_promo_cap = null;
    const listing = deriveListingType({
      plan: "free",
      rates: zeroRates,
      currentListingType: "partner",
    });
    if (listing !== undefined) patch.listing_type = listing;
    patch.plan_live_at = null;
    patch.first_ticket_honored_at = null;
    patch.plan_forfeited_at = iso;
    patch.promo_paused_until = null;
  }

  return patch;
}
