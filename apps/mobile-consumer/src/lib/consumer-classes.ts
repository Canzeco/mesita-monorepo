// Compact class catalog — mirrored from web-consumer `lib/consumer-data.ts`.
// Ascending ladder: standard (default) < premium (paid) < magnetic (top,
// invite-only via Instagram reach).

type ClassId = 'standard' | 'premium' | 'magnetic';

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
    id: 'magnetic',
    label: 'Magnetic',
    priceMxn: 0,
    followerThreshold: 1_000,
  },
];

// Premium-perk gate: everything above Standard (Premium and Magnetic).
export function isElevatedClass(classKey: string): boolean {
  return classKey === 'premium' || classKey === 'magnetic';
}

// Compact Title-Case label per class id. Unknown values fall back to "Mesita".
const CLASS_LABELS: Record<string, string> = {
  standard: 'Standard',
  premium: 'Premium',
  magnetic: 'Magnetic',
};

export function classProperLabel(classKey: string): string {
  return CLASS_LABELS[classKey] ?? 'Mesita';
}

/**
 * Premium subscribe handoff — design lock profile-premium-20260720.
 * Opens web /me (never Stripe/PaymentSheet/IAP in the iOS binary).
 */
export const PREMIUM_SUBSCRIBE_URL = 'https://consumer.mesita.ai/me';
