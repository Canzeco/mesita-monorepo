// Compact class catalog — mirrored from web-consumer `lib/consumer-data.ts`.
// Ascending ladder (segments v6, canonical order MESITA-972): standard
// (default) < influencer (Instagram ≥ 2,000 followers, automatic) < premium
// (paid) < aura (invite-only presence class) — mirrors classes.rank in the DB
// and the money ladder (class steps +5 influencer / +10 premium / +15 aura).
//
// GUEST-FACING NAMES ARE bronze/silver/gold/diamond (MESITA-1449): the `id`s
// below stay the legacy standard/influencer/premium/aura keys — they are the
// DB values (classes.rank) and drive every comparison in this file and its
// consumers (isElevatedClass, follower-threshold lookups, etc.) — only the
// display `label`s changed, matching TicketScreen.tsx's existing
// legacyKey -> bronze/silver/gold/diamond bridge exactly (standard->Bronze,
// influencer->Silver, premium->Gold, aura->Diamond). Same two-layer shape web
// already documents for its own class-context: legacy keys bridge underneath,
// never merged into the earned-name ladder guests actually see.

import {
  CreditCard,
  Crown,
  Megaphone,
  Pyramid,
  Smile,
  type LucideIcon,
} from 'lucide-react-native';
import { GRADIENTS } from '@/constants/brand';

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

export const CLASSES: {
  id: ClassId;
  label: string;
  priceMxn: number;
  followerThreshold: number;
}[] = [
  {
    id: 'standard',
    label: 'Bronze',
    priceMxn: 0,
    followerThreshold: 0,
  },
  {
    id: 'influencer',
    label: 'Silver',
    priceMxn: 0,
    // Mirrors classes.follower_threshold in the DB — the EF grants off that
    // row, so this constant is display-only and must track it.
    followerThreshold: 2_000,
  },
  {
    id: 'premium',
    label: 'Gold',
    priceMxn: 50,
    followerThreshold: 0,
  },
  {
    id: 'aura',
    label: 'Diamond',
    priceMxn: 0,
    followerThreshold: 0,
  },
];

// `INFLUENCER_FOLLOWER_THRESHOLD` LIVED HERE AND IS GONE (MESITA-2040). It
// carried 2,000 while web's ladder carried 1,000, both claiming to mirror
// `classes.follower_threshold`, and nothing on either side compared them — the
// drift guard was a comment. The bar is `INSTAGRAM_REACH_FOLLOWERS` in
// consumer-identity.ts now, 1,000 on both platforms, and it grants no class at
// all: it makes an account VERIFIED. Story Bonus still rides a connected
// handle (MESITA-909), never the bar.

// Canonical class icon set (MESITA-929): Smile gray · Megaphone red ·
// CreditCard blue · Crown yellow. Mirrors web CLASS_ICONS.
export const CLASS_ICONS: Record<ClassId, LucideIcon> = {
  standard: Smile,
  premium: CreditCard,
  influencer: Megaphone,
  aura: Crown,
};

/** Sheet / section mark for the Classes surface (not a membership class). */
export const CLASS_MARK_ICON: LucideIcon = Pyramid;

// Premium-perk gate: everything above Standard unlocks the same elevated perk
// set. Generic on purpose: a future class joins the ladder by joining
// CLASS_ORDER, never by another branch here.
export function isElevatedClass(classKey: string): boolean {
  return (
    classKey !== 'standard' &&
    (CLASS_ORDER as readonly string[]).includes(classKey)
  );
}

// Compact Title-Case label per class id. Unknown values fall back to "Mesita".
const CLASS_LABELS: Record<string, string> = {
  standard: 'Bronze',
  premium: 'Gold',
  influencer: 'Silver',
  aura: 'Diamond',
};

export function classProperLabel(classKey: string): string {
  return CLASS_LABELS[classKey] ?? 'Mesita';
}

/**
 * Premium subscribe handoff — design lock profile-premium-20260720.
 * Opens web /me (never Stripe/PaymentSheet/IAP in the iOS binary).
 */
// Web handoff only (Apple posture: no in-app checkout). Keep in lock-step
// with consumer-route-contract /subscribe/premium.
export const PREMIUM_SUBSCRIBE_URL =
  'https://consumer.mesita.ai/me/plan';
