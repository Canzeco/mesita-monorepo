// Storage keys for a guest's `consumers.class_key`, and the bridge from what
// the server sends to what this app compares on.
//
// THERE ARE NO CLASSES FOR GUESTS (Pato, MESITA-2044: "either you are diamond
// or you are not ... Diamond List"). A guest is on the Diamond List or not.
// The ids below stay the legacy standard/influencer/premium/aura keys because
// every comparison in this app (isElevatedClass, the mock, the ticket pass)
// was written against them — they are STORAGE, never copy. Nothing here names
// a rung to a guest; `diamondLabelForClass` is the only label left and it says
// "Diamond" or nothing.

import { GRADIENTS } from '@/constants/brand';
import { DIAMOND } from '@/lib/consumer-identity';

const CLASS_ORDER = ['standard', 'influencer', 'premium', 'aura'] as const;
export type ClassId = (typeof CLASS_ORDER)[number];

// THE CLASS METAL RING — one canonical bridge from the legacy class id to its
// achromatic-era ink ramp (MESITA-1954). Four files (IdentityHero.tsx,
// CurrentClassCard.tsx, ClassRail.tsx, WaysToClimb.tsx) hand-rolled this
// bridge independently after the achromatic repaint, and all four wired it
// the same wrong way: they matched on KEY NAME rather than on MEANING —
// `influencer: GRADIENTS.influencer` reads as correct because the strings
// match, but `GRADIENTS.influencer` is documented in brand.ts as Diamond's
// ink band, not Influencer/Silver's. The result: standard(Bronze) got
// Silver's grey, influencer(Silver) got Diamond's blue, premium(Gold) got the
// Plan's ink ramp, and aura(Diamond) got Gold's gold — every guest saw the
// wrong metal on every screen built after the repaint.
//
// This is the INK anchor: for a ring or a background NOTHING PRINTS ON, one
// lightness step darker than the metal's badge fill. A surface with a label
// ON the metal (a pass, a class badge) needs the LIGHTER fill instead, not
// this map; the two are
// deliberately different scales for the same reason web keeps
// `--gradient-<metal>` (fill) and `--tier-<metal>` (ink) apart.
export const CLASS_METAL_INK_GRADIENT: Record<ClassId, readonly [string, string]> = {
  // Bronze has no entry of its own in GRADIENTS — every other metal's ink ramp
  // lives there, keyed by a legacy name that happens to match, but bronze was
  // never given one. Reusing TicketScreen's own vetted bronze stops (its
  // 3-stop pass ramp is `#c9834f, #b4703f, #954c28`) rather than inventing a
  // new hex: the mid and dark stops are already the measured, shipped values.
  standard: ['#b4703f', '#954c28'],
  influencer: GRADIENTS.free, // Silver — GRADIENTS.free is the silver grey
  premium: GRADIENTS.gold, // Gold
  aura: GRADIENTS.influencer, // Diamond — GRADIENTS.influencer IS diamond's band
};

// `INFLUENCER_FOLLOWER_THRESHOLD` LIVED HERE AND IS GONE (MESITA-2040). It
// carried 2,000 while web's ladder carried 1,000, both claiming to mirror
// `classes.follower_threshold`, and nothing on either side compared them — the
// drift guard was a comment. The bar is `INSTAGRAM_REACH_FOLLOWERS` in
// consumer-identity.ts now, 1,000 on both platforms, and it grants no class at
// all: it makes an account VERIFIED. Story Bonus still rides a connected
// handle (MESITA-909), never the bar.

// Elevated-perk gate (AI Connector, the elevated promo rate): the Premium
// plan or Diamond — after `legacyKeyForStoredClass`, those are the
// only two non-`standard` keys this app ever holds. A perk, never a rate row.
export function isElevatedClass(classKey: string): boolean {
  return (
    classKey !== 'standard' &&
    (CLASS_ORDER as readonly string[]).includes(classKey)
  );
}

/** The server writes METALS now (`bronze`/`diamond`, and a stray
 *  `silver`/`gold` row can still exist); older payloads and this app speak the
 *  legacy keys. One bridge, used by the auth provider:
 *
 *    diamond / aura            → aura      (Diamond)
 *    premium plan, not listed  → premium   (the perk carrier, never a rate)
 *    everything else           → standard  (not Diamond)
 *
 *  Before MESITA-2044 the provider only knew the legacy keys, so EVERY metal —
 *  including a real `diamond` — normalized to `standard`, and a guest on the
 *  list read "not on it" on mobile while web told them the truth. Silver and
 *  Gold map to "not Diamond" on purpose: they no longer exist for guests,
 *  and a row still carrying one must not surface as anything. */
export function legacyKeyForStoredClass(
  rawKey: string | null | undefined,
  plan?: string | null,
): ClassId {
  if (rawKey === 'diamond' || rawKey === 'aura') return 'aura';
  if (plan === 'premium' || rawKey === 'premium') return 'premium';
  return 'standard';
}

/** Diamond? Accepts the legacy key or the metal. */
export function isDiamond(classKey: string | null | undefined): boolean {
  return classKey === 'aura' || classKey === 'diamond';
}

/** The ONLY guest-facing label a stored class key has: the name when
 *  the guest is Diamond, nothing otherwise. There is no "Bronze" to print. */
export function diamondLabelForClass(classKey: string | null | undefined): string | null {
  return isDiamond(classKey) ? DIAMOND : null;
}

/**
 * Premium subscribe handoff — design lock profile-premium-20260720.
 * Opens web /me (never Stripe/PaymentSheet/IAP in the iOS binary).
 */
// Web handoff only (Apple posture: no in-app checkout). Keep in lock-step
// with consumer-route-contract /subscribe/premium.
export const PREMIUM_SUBSCRIBE_URL =
  'https://consumer.mesita.ai/me/plan';
