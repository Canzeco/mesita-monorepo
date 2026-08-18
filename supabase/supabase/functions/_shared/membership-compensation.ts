import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** Aggressive-rate compensation for a burned guest (peak strategy after Dominant retired). */
export const COMPENSATION_RATES = {
  welcome_free_rate: 30,
  welcome_premium_rate: 50,
  free_rate: 10,
  premium_rate: 30,
} as const;

/** Issue an Aggressive-rate compensation coupon at another live partner place. */
export async function compensateBurnedGuest(
  admin: SupabaseClient,
  opts: { burnedProjectId: string; consumerId: string },
): Promise<
  { ok: true; couponId: string; projectId: string } | {
    ok: false;
    error: string;
  }
> {
  // Prefer another live partner place; fall back to any other partner.
  const live = await admin
    .from("projects")
    .select("id, currency")
    .eq("listing_type", "partner")
    .neq("id", opts.burnedProjectId)
    .not("plan_live_at", "is", null)
    .is("plan_forfeited_at", null)
    .or("promo_paused_until.is.null,promo_paused_until.lt.now()")
    .limit(20);
  let candidates = live.data ?? [];
  if (candidates.length === 0) {
    const any = await admin
      .from("projects")
      .select("id, currency")
      .eq("listing_type", "partner")
      .neq("id", opts.burnedProjectId)
      .limit(20);
    candidates = any.data ?? [];
  }
  if (candidates.length === 0) {
    return { ok: false, error: "no_partner_place_for_compensation" };
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)]!;
  const insert = await admin
    .from("coupons")
    .insert({
      consumer_id: opts.consumerId,
      project_id: pick.id,
      status: "active",
      welcome_free_rate: COMPENSATION_RATES.welcome_free_rate,
      welcome_premium_rate: COMPENSATION_RATES.welcome_premium_rate,
      free_rate: COMPENSATION_RATES.free_rate,
      premium_rate: COMPENSATION_RATES.premium_rate,
      cap_cents: 50000, // MX$500 default discount cap in cents
      currency: (pick as { currency?: string }).currency ?? "MXN",
    })
    .select("id")
    .single();
  if (insert.error) {
    // Already has an active coupon at that place — boost its rates instead.
    const boost = await admin
      .from("coupons")
      .update({
        welcome_free_rate: COMPENSATION_RATES.welcome_free_rate,
        welcome_premium_rate: COMPENSATION_RATES.welcome_premium_rate,
        free_rate: COMPENSATION_RATES.free_rate,
        premium_rate: COMPENSATION_RATES.premium_rate,
        cap_cents: 50000,
      })
      .eq("consumer_id", opts.consumerId)
      .eq("project_id", pick.id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (boost.data?.id) {
      return {
        ok: true,
        couponId: boost.data.id as string,
        projectId: pick.id,
      };
    }
    return { ok: false, error: insert.error.message };
  }
  return { ok: true, couponId: insert.data.id as string, projectId: pick.id };
}
