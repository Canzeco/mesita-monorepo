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

const CLASS_ORDER = ['standard', 'influencer', 'premium', 'aura'] as const;
type ClassId = (typeof CLASS_ORDER)[number];

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
