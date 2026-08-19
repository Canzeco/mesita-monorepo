// Orders config — the policy for the REMOTE context (MESITA — Orders Config).
//
// Mesita has exactly two contexts, and Promos prices both: a VISIT (the guest
// is at the place) and an ORDER (the guest is not). Visits shipped; orders are
// parked everywhere — no orders table, no order EF, no consumer type — and the
// three surfaces that mention them say "soon": the Premium perk list ("30
// orders per month"), the Inbox › Orders section, and the parked `orders`
// column of the Promos v11 grid.
//
// This module is the single normalizer for the orders policy blob, shared by
// the admin get/update EFs and (when it ships) by the order EFs themselves —
// so the console and the engine can never disagree about defaults.
//
// RATES ARE NOT HERE. What an order PAYS lives in the Promos grid's `orders`
// context, which is its own page and its own guard (`additivityError`). This
// blob is everything else: whether orders exist at all, how a guest places
// one, how many they get, and what makes one eligible to be rewarded.
//
// Every knob is STAGED until the order rail ships: the blob is live and
// editable, nothing reads it yet, and the console says so. House rule is that
// an unenforced config is a bug — a staged one has to be labeled.

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

export const ORDERS_DEFAULTS: OrdersConfig = {
  // OFF by default: the rail does not exist yet, and the master switch is what
  // un-parks it. Nothing about this page should imply orders are live.
  enabled: false,
  channels: {
    // Mesita-hosted cart and checkout — not built, and the biggest of the
    // three to build, since it makes Mesita the merchant of record.
    inHouse: false,
    // The place's own ordering link (its site, or whatever aggregator it
    // already sells through). The only channel that needs no new rail: the
    // link is already a place field.
    externalLink: true,
    whatsapp: false,
  },
  delivery: true,
  pickup: true,
  // Free gets none: orders are a Premium perk on the consumer plan sheet, and
  // 30/month is the number that sheet already promises a subscriber.
  monthlyQuotaFree: 0,
  monthlyQuotaPremium: 30,
  minOrderMxn: 150,
  // A reward is claimable for a day after the order. Long enough for a late
  // delivery, short enough that a receipt is still findable.
  rewardWindowHours: 24,
  // A remote order has no QR and no staff at the table, so the receipt IS the
  // proof. Ojo reads it once its engine ships.
  requireProof: true,
};

function num(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

/** Tolerant read: any missing/invalid key falls back to its default. */
export function normalizeOrdersConfig(raw: unknown): OrdersConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const ch = (r.channels ?? {}) as Record<string, unknown>;
  const free = Math.round(
    num(r.monthlyQuotaFree, ORDERS_DEFAULTS.monthlyQuotaFree, 0, 1000),
  );
  return {
    enabled: bool(r.enabled, ORDERS_DEFAULTS.enabled),
    channels: {
      inHouse: bool(ch.inHouse, ORDERS_DEFAULTS.channels.inHouse),
      externalLink: bool(
        ch.externalLink,
        ORDERS_DEFAULTS.channels.externalLink,
      ),
      whatsapp: bool(ch.whatsapp, ORDERS_DEFAULTS.channels.whatsapp),
    },
    delivery: bool(r.delivery, ORDERS_DEFAULTS.delivery),
    pickup: bool(r.pickup, ORDERS_DEFAULTS.pickup),
    monthlyQuotaFree: free,
    // Premium can never allow FEWER orders than Free, or the paid plan would
    // take a perk away — the same class of guard as Ojo's band clamp.
    monthlyQuotaPremium: Math.max(
      free,
      Math.round(
        num(
          r.monthlyQuotaPremium,
          ORDERS_DEFAULTS.monthlyQuotaPremium,
          0,
          1000,
        ),
      ),
    ),
    minOrderMxn: Math.round(
      num(r.minOrderMxn, ORDERS_DEFAULTS.minOrderMxn, 0, 100000),
    ),
    rewardWindowHours: Math.round(
      num(r.rewardWindowHours, ORDERS_DEFAULTS.rewardWindowHours, 1, 720),
    ),
    requireProof: bool(r.requireProof, ORDERS_DEFAULTS.requireProof),
  };
}
