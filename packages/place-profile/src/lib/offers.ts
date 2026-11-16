// THE OFFER SLIDES' WORDS (MESITA-4151): plain data, no React, so the row's
// state and its tests read them without a renderer. The beat and the moving
// track are components/place-detail/offer-slides.tsx.

import type { RewardsSection } from "../actions";

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
 *  _shared/money.ts VOUCHER_CATALOG: Small +10%, Big +30%, Medium +20%). */
const STANDARD_BONUS: Record<string, number> = {
  voucher_200: 10,
  voucher_1000: 30,
  voucher_5000: 20,
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
