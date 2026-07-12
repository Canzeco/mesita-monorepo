// Compact class catalog — mirrored from web-consumer `lib/consumer-data.ts`.

export type ClassId = 'free' | 'premium';

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

/** Web subscribe path — opened in the system browser (no Stripe in-app). */
export const PREMIUM_SUBSCRIBE_URL =
  'https://consumer.mesita.ai/subscribe/premium';
