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
// ONE COLOUR PER KIND (Pato, 2026-11-16, MESITA-4207): the sizes green,
// Welcome blue, Story pink like Instagram, soft tints with black ink, the
// Offers page's own chip colours. Link green (bg-green-400) for all before.
// THE GREEN IS STRIPE LINK'S (Pato, 2026-11-17, MESITA-4210: "MAKE THE DARK
// GREEN BACK AGAIN. USING THE STRIPE LINK COLORS KINDA"): #00D66F, black ink;
// MESITA-4207's pale green-200 is gone.
// STRONG TINTS FOR ALL (Pato, 2026-11-17, MESITA-4211: "story must be darker
// too. also welcome. and vip must be yellow."): the 400 weight next to Link
// green, black ink; VIP has its own yellow again.
const GREEN = "bg-[#00D66F] text-neutral-950";
const BLUE = "bg-blue-400 text-neutral-950";
const PINK = "bg-pink-400 text-neutral-950";
const YELLOW = "bg-yellow-400 text-neutral-950";

/** THE ONE COLOUR MAP (autoplan F5, MESITA-4207): the slides, the Home chips
 *  and the Offers page rows (vouchers.tsx FACES) all read it, so the next
 *  colour call is one edit here. */
export const VOUCHER_TONE: Record<MoneyVoucherKey, string> = {
  voucher_welcome: BLUE,
  voucher_story: PINK,
  voucher_vip: YELLOW,
  voucher_200: GREEN,
  voucher_1000: GREEN,
  voucher_5000: GREEN,
};
const OFFER_SLIDES: OfferSlide[] = [
  { key: "voucher_welcome", lead: "Welcome", pill: "+100%", short: "Welcome", spoken: "Welcome prepay, 100% bonus", section: "special", tone: VOUCHER_TONE.voucher_welcome, bonus: 100 },
  // Story +50% since MESITA-4207 (pay $100, get $150); +30% before.
  { key: "voucher_story", lead: "Story", pill: "+50%", short: "Story", spoken: "Story prepay, 50% bonus", section: "special", tone: VOUCHER_TONE.voucher_story, bonus: 50 },
  { key: "voucher_vip", lead: "VIP", pill: "+100%", short: "VIP", spoken: "VIP prepay, 100% bonus", section: "special", tone: VOUCHER_TONE.voucher_vip, bonus: 100 },
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

/** One chip on a Home card (MESITA-4207). */
export type OfferChip = {
  key: string;
  /** "Welcome +100%". */
  label: string;
  /** "Welcome voucher: 100% bonus", read aloud. */
  spoken: string;
  section: RewardsSection;
  tone: string;
};

/** EVERY OFFER AS A CHIP (Pato, 2026-11-16, MESITA-4207 design review: "the
 *  preliminar offers in the home view look like shit"): one chip per voucher
 *  the guest can buy here, Welcome · Story · VIP · Small · Medium · Big, no
 *  rotation. Home's list row carries `sell` per guest (consumer-web-list-places). */
const CHIPS: { key: string; name: string; bonus: number; section: RewardsSection; tone: string }[] = [
  { key: "voucher_welcome", name: "Welcome", bonus: 100, section: "special", tone: VOUCHER_TONE.voucher_welcome },
  { key: "voucher_story", name: "Story", bonus: 50, section: "special", tone: VOUCHER_TONE.voucher_story },
  { key: "voucher_vip", name: "VIP", bonus: 100, section: "special", tone: VOUCHER_TONE.voucher_vip },
  { key: "voucher_200", name: "Small", bonus: STANDARD_BONUS.voucher_200, section: "prepayment", tone: VOUCHER_TONE.voucher_200 },
  { key: "voucher_1000", name: "Medium", bonus: STANDARD_BONUS.voucher_1000, section: "prepayment", tone: VOUCHER_TONE.voucher_1000 },
  { key: "voucher_5000", name: "Big", bonus: STANDARD_BONUS.voucher_5000, section: "prepayment", tone: VOUCHER_TONE.voucher_5000 },
];

export function offerChips(offers: OfferInput | null | undefined): OfferChip[] {
  if (!offers) return [];
  const sell = new Set(offers.sell);
  return CHIPS.filter((c) => sell.has(c.key)).map((c) => ({
    key: c.key,
    label: `${c.name} +${c.bonus}%`,
    spoken: `${c.name} voucher: ${c.bonus}% bonus`,
    section: c.section,
    tone: c.tone,
  }));
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
