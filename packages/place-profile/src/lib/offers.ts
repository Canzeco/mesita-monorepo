// THE OFFER SLIDES' WORDS (MESITA-4151): plain data, no React, so the row's
// state and its tests read them without a renderer. The beat and the moving
// track are components/place-detail/offer-slides.tsx.

import type { RewardsSection } from "../actions";
import type { MoneyVoucherKey } from "../money-state";

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
  /** The voucher a tap ticks on the Offers page (`?voucher=`, MESITA-4219). */
  voucher?: string;
};

/** What a place offers now: the list row's `offers` and the place screen's
 *  money read both fit. */
export type OfferInput = {
  sell: readonly string[];
};

// THE WORDS ARE PATO'S (MESITA-3475, MESITA-3791: "ONLY SHOW THE HIGHEST
// STANDARD VOUCHER"). Pay reads "5% Back" with no "+" (MESITA-3871).
// EVERY OFFER IS GREEN (MESITA-4181, Pato: "I WANT ALL OFFERS GREEN … JUST
// GREENS, LESS CONFUSION"): Link green for all of them.
// THE GREEN IS STRIPE LINK'S (Pato, 2026-11-17, MESITA-4210: "MAKE THE DARK
// GREEN BACK AGAIN. USING THE STRIPE LINK COLORS KINDA"): #00D66F, black ink;
// MESITA-4207's pale green-200 is gone.
// The Story offer is gone (MESITA-4641). The Welcome offer is back
// (MESITA-4645; gone 2026-11-21, MESITA-4636), green like every offer.
const GREEN = "bg-[#00D66F] text-neutral-950";

/** THE ONE COLOUR MAP (autoplan F5, MESITA-4207): the slides, the Home chips
 *  and the Offers page rows (vouchers.tsx FACES) all read it, so the next
 *  colour call is one edit here. */
export const VOUCHER_TONE: Record<MoneyVoucherKey, string> = {
  voucher_welcome: GREEN,
  voucher_200: GREEN,
  voucher_1000: GREEN,
  voucher_5000: GREEN,
  // Every offer green (MESITA-4181) but VIP: YELLOW (Pato, 2026-11-22,
  // MESITA-4688: "VIP voucher must be yellow"), black ink, the crown on it.
  voucher_vip: "bg-[#FFD60A] text-neutral-950",
};
// THE WORDS (Pato, 2026-11-17, MESITA-4219): Classic, the best standard
// voucher, leads; every pill reads "+N% Bonus" on every screen (the "+"
// back, MESITA-4221). Prepay led with "+N%" before.
const OFFER_SLIDES: OfferSlide[] = [
  // The best standard voucher on sale (offerSlides picks it).
  // "Prepay" on the previews since MESITA-4255 (Pato: "instead of classic use
  // the word prepay. its just clearer"); the Offers page keeps its "Classic
  // Offers" and "Special Offers" panels.
  { key: "prepay", lead: "Prepay", pill: "", short: "Prepay", spoken: "Prepay", section: "prepayment", tone: GREEN },
  // Welcome is back (MESITA-4645): pay $100, get $200.
  { key: "voucher_welcome", lead: "Welcome", pill: "+100% Bonus", short: "Welcome", spoken: "Welcome, 100% bonus", section: "special", tone: VOUCHER_TONE.voucher_welcome, bonus: 100, voucher: "voucher_welcome" },
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
  const standard = Object.entries(STANDARD_BONUS).filter(([key]) => sell.has(key));
  const top = standard.reduce<[string, number] | null>((a, b) => (a && a[1] >= b[1] ? a : b), null);
  return OFFER_SLIDES.flatMap((s): OfferSlide[] => {
    if (s.key === "prepay")
      return top ? [{ ...s, pill: `+${top[1]}% Bonus`, spoken: `Prepay, ${top[1]}% bonus`, bonus: top[1], voucher: top[0] }] : [];
    return sell.has(s.key) ? [s] : [];
  });
}

/** What a screen reader hears: every offer, once. */
export function offersLabel(name: string, slides: OfferSlide[]): string {
  return `Offers at ${name}: ${slides.map((s) => s.spoken).join("; ")}`;
}

/** THE PLACE SCREEN ROW'S OFFER WORDS (Pato, MESITA-4184): the same slides
 *  as Home since MESITA-4219, Prepay first, "N% Bonus". */
export function rowOfferSlides(offers: OfferInput | null | undefined): OfferSlide[] {
  return offerSlides(offers);
}
