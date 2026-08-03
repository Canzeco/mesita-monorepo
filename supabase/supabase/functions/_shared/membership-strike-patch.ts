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
    // Warning + re-run activation test: clear the ping stamp.
    patch.staff_channel_pinged_at = null;
  } else if (strikeNumber === 2) {
    patch.promo_paused_until = new Date(now.getTime() + PROMO_PAUSE_MS)
      .toISOString();
  } else {
    // Strike 3: remove paid posture, forfeit fee stamp, keep catalog listing.
    //
    // "Keep catalog listing" means the place stays browsable — it does NOT
    // mean it keeps running rewards. Verified Partner tracks the paid
    // membership (MESITA-818: admin-web-set-plan promotes on a paid plan and
    // demotes on Zero), so forfeiting the membership demotes here too;
    // otherwise a struck-out place would keep an openable ticket lane with
    // every rate nulled. Unconditional 'web' is safe: only a partner can
    // reach strike 3.
    patch.plan = "free";
    patch.listing_type = "web";
    patch.welcome_free_rate = null;
    patch.welcome_premium_rate = null;
    patch.free_rate = null;
    patch.premium_rate = null;
    patch.monthly_promo_cap = null;
    patch.membership_live_at = null;
    patch.membership_forfeited_at = iso;
    patch.promo_paused_until = null;
  }

  return patch;
}
