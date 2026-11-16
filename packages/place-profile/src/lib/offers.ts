// THE OFFER SLIDES' WORDS (MESITA-4151): plain data, no React, so the row's
// state and its tests read them without a renderer. The beat and the moving
// track are components/place-detail/offer-slides.tsx.

import type { RewardsSection } from "../actions";
import type { PlaceMoney } from "../place-detail";
import { moneyLabel } from "./money";

/** One offer on the moving button (MESITA-3467). */
export type OfferSlide = {
  key: string;
  /** The words before the ink pill. */
  lead: string;
  pill: string;
  /** The short word before the pill on Places 3.0's narrow card (MESITA-3671). */
  short: string;
  /** Read aloud in the button's label. */
  spoken: string;
  /** The Offers page section it opens; null = cashback (Pay), no section. */
  section: RewardsSection | null;
  /** The box's colour and ink while this slide shows (MESITA-3475). */
  tone: string;
  /** A voucher's bonus in percent; the list band reads the best one. */
  bonus?: number;
};

/** What a place offers now: the list row's `offers` and the place screen's
 *  money read both fit. */
export type OfferInput = {
  cashback: boolean;
  card_cashback_bps?: number;
  sell: readonly string[];
};

// THE WORDS AND COLOURS ARE PATO'S (MESITA-3475, MESITA-3791: "Welcome (+X%)
// · Story (+X%) · VIP (+X%) · Pay (+X% Back) · Prepay (+X%) ONLY SHOW THE
// HIGHEST STANDARD VOUCHER"): blue Welcome, Instagram-pink Story, gold VIP,
// Link green for the rest. Pay reads "5% Back" with no "+" (MESITA-3871).
const GREEN = "bg-green-400 text-neutral-950";
const OFFER_SLIDES: OfferSlide[] = [
  { key: "voucher_welcome", lead: "Welcome", pill: "+100%", short: "Welcome", spoken: "Welcome prepay, 100% bonus", section: "special", tone: "bg-[#2563EB] text-white", bonus: 100 },
  { key: "voucher_story", lead: "Story", pill: "+30%", short: "Story", spoken: "Story prepay, 30% bonus", section: "special", tone: "bg-[#E1306C] text-white", bonus: 30 },
  { key: "voucher_vip", lead: "VIP", pill: "+100%", short: "VIP", spoken: "VIP prepay, 100% bonus", section: "special", tone: "bg-[#F5B301] text-neutral-950", bonus: 100 },
  // The pill is the place's own card rate (offerSlides fills it in).
  { key: "cashback", lead: "Pay", pill: "Back", short: "Pay", spoken: "Mesita Pay cashback", section: null, tone: GREEN },
  // The best standard voucher on sale (offerSlides picks it).
  { key: "prepay", lead: "Prepay", pill: "", short: "Prepay", spoken: "Prepay", section: "prepayment", tone: GREEN },
];

/** The standard vouchers' bonuses: the server's catalog (supabase
 *  _shared/money.ts VOUCHER_CATALOG: Small +10%, Medium +20%, Big +30%; MESITA-4152). */
const STANDARD_BONUS: Record<string, number> = {
  voucher_200: 10,
  voucher_1000: 20,
  voucher_5000: 30,
};

/** The place's slides, in the fixed order; none = nothing to show. */
export function offerSlides(offers: OfferInput | null | undefined): OfferSlide[] {
  if (!offers) return [];
  const sell = new Set(offers.sell);
  // The Pay slide says the place's own card rate (MESITA-3589); an older
  // answer without it shows no slide rather than a guessed number.
  const bps = offers.card_cashback_bps ?? 0;
  const best = Math.max(
    0,
    ...Object.entries(STANDARD_BONUS)
      .filter(([key]) => sell.has(key))
      .map(([, bonus]) => bonus),
  );
  return OFFER_SLIDES.flatMap((s): OfferSlide[] => {
    if (s.key === "cashback")
      return offers.cashback && bps > 0
        ? [{ ...s, pill: `${bps / 100}% Back`, spoken: `Mesita Pay, ${bps / 100}% back` }]
        : [];
    if (s.key === "prepay")
      return best > 0 ? [{ ...s, pill: `+${best}%`, spoken: `Prepay, ${best}% bonus`, bonus: best }] : [];
    return sell.has(s.key) ? [s] : [];
  });
}

/** What a screen reader hears: every offer, once. */
export function offersLabel(name: string, slides: OfferSlide[]): string {
  return `Offers at ${name}: ${slides.map((s) => s.spoken).join("; ")}`;
}

// THE PLACE SCREEN'S OFFERS TILE SAYS THE WHOLE OFFER (Pato, 2026-11-16,
// MESITA-4155: "list actually all the offers with all the details ...
// (Prepay $200MX, Get $220MX) ... (Pay with Mesita, Get 5% Back). This shit
// rotating"): one line per offer the place sells now, the sizes, then the
// specials, then cashback. Amounts are the server catalog's, never typed.
const DETAIL_ORDER: { key: string; section: RewardsSection }[] = [
  { key: "voucher_200", section: "prepayment" },
  { key: "voucher_1000", section: "prepayment" },
  { key: "voucher_5000", section: "prepayment" },
  { key: "voucher_welcome", section: "special" },
  { key: "voucher_story", section: "special" },
  { key: "voucher_vip", section: "special" },
];

/** "$5000MX": whole amounts read without cents or a thousands comma, as
 *  Pato wrote them; anything with cents keeps them. */
export function shortMoney(cents: number, currency: string): string {
  return moneyLabel(cents, currency).replace(/\.00(?=\D*$)/, "").replace(/,/g, "");
}

/** The tile's slides, from the place's money read; none = Off. */
export function offerDetailSlides(money: PlaceMoney | null | undefined): OfferSlide[] {
  if (!money) return [];
  const sell = new Set<string>(money.sell ?? []);
  const currency = money.currency ?? "mxn";
  const slides: OfferSlide[] = [];
  for (const { key, section } of DETAIL_ORDER) {
    const line = money.catalog?.[key as keyof typeof money.catalog];
    if (!sell.has(key) || !line || line.price_cents <= 0) continue;
    // "Prepay $1000MX, Get 20% Bonus" (Pato, MESITA-4157): the bonus over the price.
    const pct = Math.round((line.bonus_cents * 100) / line.price_cents);
    const text = `Prepay ${shortMoney(line.price_cents, currency)}, Get ${pct}% Bonus`;
    slides.push({ key, lead: "", pill: text, short: "", spoken: text, section, tone: "" });
  }
  const bps = money.card_cashback_bps ?? 0;
  if (money.cashback && bps > 0) {
    const text = `Pay with Mesita, Get ${bps / 100}% Back`;
    slides.push({ key: "cashback", lead: "", pill: text, short: "", spoken: text, section: null, tone: "" });
  }
  return slides;
}
