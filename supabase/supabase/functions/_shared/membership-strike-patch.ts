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
    patch.plan = "free";
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
