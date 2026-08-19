// Orders config shape + defaults. Deliberately NOT in actions.ts: that file is
// "use server", and a Server Actions module may export only async functions —
// a const export there fails Next's page-data collection at build time.
// Mirrors supabase/functions/_shared/orders-config.ts, which is authoritative.

export type OrdersChannels = {
  inHouse: boolean;
  externalLink: boolean;
  whatsapp: boolean;
};

export type OrdersConfig = {
  enabled: boolean;
  channels: OrdersChannels;
  delivery: boolean;
  pickup: boolean;
  monthlyQuotaFree: number;
  monthlyQuotaPremium: number;
  minOrderMxn: number;
  rewardWindowHours: number;
  requireProof: boolean;
};

export const ORDERS_FALLBACK: OrdersConfig = {
  enabled: false,
  channels: { inHouse: false, externalLink: true, whatsapp: false },
  delivery: true,
  pickup: true,
  monthlyQuotaFree: 0,
  monthlyQuotaPremium: 30,
  minOrderMxn: 150,
  rewardWindowHours: 24,
  requireProof: true,
};
