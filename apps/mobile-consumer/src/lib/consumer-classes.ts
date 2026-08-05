// Compact class catalog — mirrored from web-consumer `lib/consumer-data.ts`.
// Ascending ladder (segments v6): standard (default) < premium (paid) <
// influencer (Instagram ≥ 1,000 followers, automatic) < aura (invite-only
// presence class).

import {
  CreditCard,
  Megaphone,
  Smile,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';

const CLASS_ORDER = ['standard', 'premium', 'influencer', 'aura'] as const;
type ClassId = (typeof CLASS_ORDER)[number];

export const CLASSES: {
  id: ClassId;
  label: string;
  priceMxn: number;
  followerThreshold: number;
}[] = [
  {
    id: 'standard',
    label: 'Standard',
    priceMxn: 0,
    followerThreshold: 0,
  },
  {
    id: 'premium',
    label: 'Premium',
    priceMxn: 100,
    followerThreshold: 0,
  },
  {
    id: 'influencer',
    label: 'Influencer',
    priceMxn: 0,
    // Mirrors classes.follower_threshold in the DB — the EF grants off that
    // row, so this constant is display-only and must track it.
    followerThreshold: 1_000,
  },
  {
    id: 'aura',
    label: 'Aura',
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

// Canonical class icon set: Standard = the happy face, Premium = paying
// (card), Influencer = the megaphone (digital reach), Aura = sparkles (the
// invite-only presence class). Use these everywhere a class is iconified so
// surfaces agree (mirrors web CLASS_ICONS).
export const CLASS_ICONS: Record<ClassId, LucideIcon> = {
  standard: Smile,
  premium: CreditCard,
  influencer: Megaphone,
  aura: Sparkles,
};

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
  standard: 'Standard',
  premium: 'Premium',
  influencer: 'Influencer',
  aura: 'Aura',
};

export function classProperLabel(classKey: string): string {
  return CLASS_LABELS[classKey] ?? 'Mesita';
}

/**
 * Premium subscribe handoff — design lock profile-premium-20260720.
 * Opens web /me (never Stripe/PaymentSheet/IAP in the iOS binary).
 */
export const PREMIUM_SUBSCRIBE_URL = 'https://consumer.mesita.ai/me';
