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
  /** The Offers page section it opens. */
  section: RewardsSection | null;
  /** The box's colour and ink while this slide shows (MESITA-3475). */
  tone: string;
  /** A voucher's bonus in percent; the list band reads the best one. */
  bonus?: number;
};

/** What a place offers now: the list row's `offers` and the place screen's
 *  money read both fit. */
export type OfferInput = {
  sell: readonly string[];
};

// THE WORDS ARE PATO'S (MESITA-3475, MESITA-3791: "Welcome (+X%) · Story
// (+X%) · VIP (+X%) · Pay (+X% Back) · Prepay (+X%) ONLY SHOW THE HIGHEST
// STANDARD VOUCHER"). Pay reads "5% Back" with no "+" (MESITA-3871).
// EVERY OFFER IS GREEN (MESITA-4181, Pato: "I WANT ALL OFFERS GREEN … JUST
// GREENS, LESS CONFUSION"): Link green for all of them; MESITA-3475's blue
// Welcome, pink Story and gold VIP are gone.
const GREEN = "bg-green-400 text-neutral-950";
const OFFER_SLIDES: OfferSlide[] = [
  { key: "voucher_welcome", lead: "Welcome", pill: "+100%", short: "Welcome", spoken: "Welcome prepay, 100% bonus", section: "special", tone: GREEN, bonus: 100 },
  { key: "voucher_story", lead: "Story", pill: "+30%", short: "Story", spoken: "Story prepay, 30% bonus", section: "special", tone: GREEN, bonus: 30 },
  { key: "voucher_vip", lead: "VIP", pill: "+100%", short: "VIP", spoken: "VIP prepay, 100% bonus", section: "special", tone: GREEN, bonus: 100 },
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
  const best = Math.max(
    0,
    ...Object.entries(STANDARD_BONUS)
      .filter(([key]) => sell.has(key))
      .map(([, bonus]) => bonus),
  );
  return OFFER_SLIDES.flatMap((s): OfferSlide[] => {
    if (s.key === "prepay")
      return best > 0 ? [{ ...s, pill: `+${best}%`, spoken: `Prepay, ${best}% bonus`, bonus: best }] : [];
    return sell.has(s.key) ? [s] : [];
  });
}

/** What a screen reader hears: every offer, once. */
export function offersLabel(name: string, slides: OfferSlide[]): string {
  return `Offers at ${name}: ${slides.map((s) => s.spoken).join("; ")}`;
}

/** THE PLACE SCREEN ROW'S OFFER WORDS (Pato, MESITA-4184): Prepay leads and
 *  the bonuses read "+N% Bonus". No App Pay or Cash Pay slide since
 *  MESITA-4191. Home's offer button keeps offerSlides' words. */
export function rowOfferSlides(offers: OfferInput | null | undefined): OfferSlide[] {
  if (!offers) return [];
  const by = new Map(offerSlides(offers).map((s) => [s.key, s]));
  const ORDER = ["prepay", "voucher_welcome", "voucher_story", "voucher_vip"];
  return ORDER.flatMap((key): OfferSlide[] => {
    const s = by.get(key);
    if (!s) return [];
    return s.bonus ? [{ ...s, pill: `+${s.bonus}% Bonus` }] : [s];
  });
}
