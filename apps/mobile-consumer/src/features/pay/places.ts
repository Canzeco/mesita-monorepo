/** The numbers the Pay list prints. The server decides them; these only read the fields. */

export type VisitLine = "welcome" | "welcome_vip" | "returning" | "returning_vip";

export type PayOffers = {
  sell: string[];
  welcome_pct?: number | null;
  welcome_vip_pct?: number | null;
  returning_pct?: number | null;
  returning_vip_pct?: number | null;
  voucher_pct?: Record<string, number>;
};

export type PayPlace = {
  place_id: string;
  name: string | null;
  photo: string | null;
  distance_m: number | null;
  credits_ok?: boolean;
  offers_ok?: boolean;
  offers?: PayOffers | null;
  visit_line?: VisitLine;
};

const BONUS: Record<string, number> = { voucher_200: 10, voucher_1000: 20, voucher_5000: 30 };
export const VOUCHERS = ["voucher_200", "voucher_1000", "voucher_5000"] as const;

export function bonusPct(offers: PayOffers | null | undefined, key: string): number {
  return offers?.voucher_pct?.[key] ?? BONUS[key] ?? 0;
}

function visitBps(p: PayPlace): number {
  const o = p.offers;
  if (!o) return 0;
  const line = p.visit_line;
  const pct =
    line === "returning_vip" ? o.returning_vip_pct
    : line === "returning" ? o.returning_pct
    : line === "welcome_vip" ? (o.welcome_vip_pct !== undefined ? o.welcome_vip_pct : o.welcome_pct)
    : o.welcome_pct;
  return pct && pct > 0 ? Math.round(pct * 100) : 0;
}

export function cashbackBps(p: PayPlace): number {
  return p.offers && p.offers_ok ? visitBps(p) : 0;
}

export function acceptsCredits(p: PayPlace): boolean {
  return cashbackBps(p) > 0 || p.credits_ok === true;
}

export function sellsVoucher(p: PayPlace): boolean {
  return VOUCHERS.some((key) => p.offers?.sell.includes(key) === true);
}

export type PaySort = "closest" | "best";
export type PayShow = "all" | "one" | "cashback";

export function offerScore(p: PayPlace, kind: "prepay" | "pay"): number {
  if (kind === "prepay") {
    return VOUCHERS.reduce((sum, key) => {
      if (p.offers?.sell.includes(key) !== true) return sum;
      return sum + Math.max(0, bonusPct(p.offers, key));
    }, 0);
  }
  return cashbackBps(p);
}

export function passesShow(p: PayPlace, kind: "prepay" | "pay", show: PayShow): boolean {
  if (show === "all") return true;
  if (kind === "prepay") return show === "one" && sellsVoucher(p);
  if (show === "cashback") return cashbackBps(p) > 0;
  return false;
}
