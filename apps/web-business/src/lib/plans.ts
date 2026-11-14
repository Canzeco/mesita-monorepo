import type { BoostTier, PlacePremier } from "@/lib/business-api";
import { day } from "@/lib/format";
import { ORIGIN_OF_SOURCE, REFILL_ORIGIN } from "@/lib/premier-origin";
import { FREE_PLAN as FREE_PLAN_NAME, planName as planNameOf } from "@mesita/place-profile/lib/place-states";

// A place's plans (Pato, 2026-11-03, MESITA-3174; one subscription since
// MESITA-3173): Free · Pro · Max, each a Premier level — Free is Premier 1X,
// Pro (boost_2x) Premier 2X, Max (boost_5x) Premier 5X. "Plans", never
// "membership". "Premier 2X/5X" stays the level guests see.
// Free and planName live in @mesita/place-profile (MESITA-3595) so the
// admin console names a plan the same way.
export { FREE_PLAN, planName } from "@mesita/place-profile/lib/place-states";
export const PLAN_NAME: Record<BoostTier, string> = {
  boost_2x: "Pro",
  boost_5x: "Max",
};
/** The visibility each plan gives, Free included: the plan's one perk. In
 *  words, not 1X · 2X · 5X (Pato, MESITA-3910: "match Business" with the guest
 *  Upgrade sheet, MESITA-3906). Index = Premier level, 0 where every place starts. */
export const LEVEL_VISIBILITY = ["Organic visibility", "High visibility boost", "Max visibility boost"] as const;
export const FREE_VISIBILITY = LEVEL_VISIBILITY[0];
export const PLAN_VISIBILITY: Record<BoostTier, string> = {
  boost_2x: LEVEL_VISIBILITY[1],
  boost_5x: LEVEL_VISIBILITY[2],
};

// ── The Premier status line (MESITA-3632; under the level in the one table, MESITA-3638) ──────────────────────────────────
// One sentence under the level: what sets it today, and at most one "then".
// "renews" vs "ends" and "then Pro" vs "then Free" are statements about a
// paid plan, so every case is pinned in plans.test.ts. Words come only from
// planName and REFILL_ORIGIN; dates only from day(). The browser clock never
// drops a clause: the server's payload is the truth.

/** The level the place runs at, from the same payload as statusLine. */
export function shownLevel(p: PlacePremier): number {
  return Math.min(Math.max(p.paid?.tier ?? 0, p.manual?.tier ?? 0, 0), 2);
}

export function statusLine(p: PlacePremier): string {
  const paid = p.paid && p.paid.tier > 0 ? p.paid : null;
  const up = p.manual && p.manual.tier > 0 ? p.manual : null;
  const plan = paid ? `${planNameOf(paid.tier)} plan` : `${FREE_PLAN_NAME} plan`;

  let planLine = plan;
  if (paid) {
    const monthly = paid.by_you && p.mine?.tier === paid.tier && p.mine?.interval === "month";
    const when = p.renewing ? "renewal being charged" : day(paid.ends_at) ? `${paid.renews ? "renews" : "ends"} ${day(paid.ends_at)}` : "";
    planLine = [plan, monthly ? "monthly" : "", when].filter(Boolean).join(" · ");
  }

  const upUntil = up ? day(up.ends_at) : "";
  if (!up || !upUntil || (paid && paid.tier >= up.tier)) return planLine;

  const origin = REFILL_ORIGIN[ORIGIN_OF_SOURCE[up.source ?? ""] ?? "mesita"];
  const upLine = `${origin} · until ${upUntil}`;
  if (!paid) return upLine;
  const outlasts = paid.renews || Date.parse(paid.ends_at) >= Date.parse(up.ends_at);
  return `${upLine} · then ${outlasts ? plan : `${FREE_PLAN_NAME} plan`}`;
}
