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

// The Influencer follower bar — mirrors classes.follower_threshold in the DB
// (the gate consumer-web-claim-instagram grants off). Story Bonus is gated
// on a connected handle (MESITA-909), not this threshold.
export const INFLUENCER_FOLLOWER_THRESHOLD = CLASSES.find(
  (c) => c.id === 'influencer',
)!.followerThreshold;

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
  'https://consumer.mesita.ai/subscribe/premium';
