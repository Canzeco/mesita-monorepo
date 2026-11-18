export type VoucherId = "small" | "medium" | "big" | "welcome";

export interface Voucher {
  id: VoucherId;
  name: string;
  /** What the guest pays. */
  price: number;
  /** Credit ready now. */
  now: number;
  /** Credit that lands 3 hours later. */
  bonus: number;
  /** Only for a guest new to the place, once ever, max quantity 1. */
  welcomeOnly: boolean;
}

export const VOUCHERS: Voucher[] = [
  { id: "small", name: "Small", price: 200, now: 200, bonus: 20, welcomeOnly: false },
  { id: "medium", name: "Medium", price: 1000, now: 1000, bonus: 200, welcomeOnly: false },
  { id: "big", name: "Big", price: 5000, now: 5000, bonus: 1500, welcomeOnly: false },
  { id: "welcome", name: "Welcome", price: 100, now: 100, bonus: 100, welcomeOnly: true },
];

export const MAX_BASKET = 5;

export interface BasketLine {
  voucher: Voucher;
  qty: number;
}

export interface Offer {
  lines: BasketLine[];
  /** Sum of voucher prices. */
  price: number;
  /** Sum of credit ready now. */
  now: number;
  /** Sum of bonus landing in 3 h. */
  bonus: number;
  /** Number of vouchers in the basket. */
  count: number;
  /** One card charge: basket + tip. */
  charge: number;
}

export interface OfferInput {
  shortfall: number;
  tip: number;
  /** New to the place and has never used Welcome. */
  newGuest: boolean;
  /** Vouchers the place checked for checkout. */
  checked: Voucher[];
  /** The place turned upselling on AND its requirements are met. */
  upsellingOn: boolean;
}

function build(lines: BasketLine[], tip: number): Offer {
  const kept = lines.filter((l) => l.qty > 0);
  const sum = (f: (v: Voucher) => number) => kept.reduce((s, l) => s + f(l.voucher) * l.qty, 0);
  const price = sum((v) => v.price);
  return {
    lines: kept,
    price,
    now: sum((v) => v.now),
    bonus: sum((v) => v.bonus),
    count: kept.reduce((s, l) => s + l.qty, 0),
    charge: price + tip,
  };
}

/**
 * The checked voucher(s) whose "now" credit covers the shortfall, or null.
 * The cheapest single voucher that covers it wins; when none does, the
 * cheapest combination, fewest vouchers on a tie. At most MAX_BASKET
 * vouchers; Welcome at most once and only for a new guest.
 */
export function selectOffer(input: OfferInput): Offer | null {
  const { shortfall, tip, newGuest, checked, upsellingOn } = input;
  if (!upsellingOn || checked.length === 0 || shortfall <= 0) return null;

  const welcome = checked.find((v) => v.welcomeOnly);
  if (newGuest && welcome && welcome.now >= shortfall) {
    return build([{ voucher: welcome, qty: 1 }], tip);
  }

  const pool = checked.filter((v) => !v.welcomeOnly || newGuest);

  // One voucher is the clearest offer: the cheapest single one that covers it.
  const single = pool
    .filter((v) => v.now >= shortfall)
    .sort((a, b) => a.price - b.price)[0];
  if (single) return build([{ voucher: single, qty: 1 }], tip);

  // No single voucher covers it: the cheapest combination, fewest on a tie.
  let best: Offer | null = null;

  const walk = (i: number, lines: BasketLine[], count: number) => {
    if (i === pool.length) {
      const o = build(lines, tip);
      if (o.count === 0 || o.now < shortfall) return;
      if (!best || o.price < best.price || (o.price === best.price && o.count < best.count)) best = o;
      return;
    }
    const v = pool[i];
    const maxQty = v.welcomeOnly ? 1 : MAX_BASKET;
    for (let q = 0; q <= maxQty && count + q <= MAX_BASKET; q++) {
      walk(i + 1, [...lines, { voucher: v, qty: q }], count + q);
    }
  };
  walk(0, [], 0);
  return best;
}

export function basketLabel(offer: Offer): string {
  return offer.lines.map((l) => (l.qty > 1 ? `${l.qty} × ${l.voucher.name}` : l.voucher.name)).join(" + ");
}
