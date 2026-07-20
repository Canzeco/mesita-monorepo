// Compact class catalog — mirrored from web-consumer `lib/consumer-data.ts`.

type ClassId = 'free' | 'premium';

export const CLASSES: {
  id: ClassId;
  label: string;
  priceMxn: number;
  followerThreshold: number;
}[] = [
  {
    id: 'free',
    label: 'Free',
    priceMxn: 0,
    followerThreshold: 0,
  },
  {
    id: 'premium',
    label: 'Premium',
    priceMxn: 100,
    followerThreshold: 1_000,
  },
];

/**
 * Premium subscribe handoff — design lock profile-premium-20260720.
 * Opens web /me (never Stripe/PaymentSheet/IAP in the iOS binary).
 */
export const PREMIUM_SUBSCRIBE_URL = 'https://consumer.mesita.ai/me';
