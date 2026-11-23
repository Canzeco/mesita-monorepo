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
  /** The pill where room is short (Pato, 2026-11-23, MESITA-4709: "if not
   *  enough space, don't mention the full offer like UP TO X%"): no leading
   *  "Up to", so "10% Cashback", "30% Bonus". The place screen's Offers tile
   *  and the narrow cards read it; wide pills keep `pill`. */
  pillShort: string;
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
  /** MESITA-4702: the place's highest cashback line in percent; absent or
   *  null = no cashback earned there (Loyalty Cards Off, every line Off). */
  cashback_pct?: number | null;
  /** Every cashback line is the same rate: the slide drops "Up to". */
  cashback_flat?: boolean;
  /** The place screen's money read carries the lines themselves (PlaceMoney). */
  cashback?: { welcome_bps: number; returning_bps: number; story_reward_cents?: number } | null;
  /** MESITA-4714: what a verified Instagram story pays there in cents (a
   *  list row's field); null or absent = Off. The place screen reads
   *  `cashback.story_reward_cents`. */
  story_cents?: number | null;
};

/** The Post slide's amount in cents, or 0 (Off). */
function storyOf(o: OfferInput): number {
  if (o.story_cents != null) return o.story_cents > 0 ? o.story_cents : 0;
  const c = o.cashback?.story_reward_cents;
  return typeof c === "number" && c > 0 ? c : 0;
}

/** The cashback slide's number: a list row's cashback_pct, else the place
 *  screen's lines. */
function cashbackOf(o: OfferInput): { pct: number; flat: boolean } {
  if (o.cashback_pct != null) return { pct: o.cashback_pct, flat: o.cashback_flat === true };
  const c = o.cashback;
  if (!c) return { pct: 0, flat: false };
  return { pct: Math.max(c.welcome_bps, c.returning_bps) / 100, flat: c.welcome_bps === c.returning_bps };
}

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
// VOUCHERS BLUE, CASHBACK GREEN (Pato, 2026-11-22, MESITA-4701: "all
// cashbacks same color, all prepayments same color. Cashback must be green.
// Vouchers must be blue."): one colour per kind of offer, whatever the size
// Every offer green (MESITA-4181) and one yellow (MESITA-4688) before.
// BLACK INK ON BLUE (Pato, 2026-11-22, MESITA-4702: "use black color in
// prepayments, it gives more confidence. blue background, black letters").
const BLUE = "bg-[#0A84FF] text-neutral-950";
// POST IS PINK (Pato, 2026-11-23, MESITA-4714: Prepay · Pay · Post): the
// third offer kind gets the third colour, neither blue nor green, black ink.
const PINK = "bg-[#FF2D78] text-neutral-950";
/** MESITA-4714: the Post slide and the Post tab's mark. */
export const POST_TONE = PINK;
export const VOUCHER_TONE: Record<MoneyVoucherKey, string> = {
  voucher_welcome: BLUE,
  voucher_200: BLUE,
  voucher_1000: BLUE,
  voucher_5000: BLUE,
  voucher_vip: BLUE,
};
/** MESITA-4701: every cashback line, one green. */
export const CASHBACK_TONE = GREEN;
// THE WORDS (Pato, 2026-11-17, MESITA-4219): Classic, the best standard
// voucher, leads; every pill reads "+N% Bonus" on every screen (the "+"
// back, MESITA-4221). Prepay led with "+N%" before.
// PAY, THEN PREPAY (Pato, 2026-11-22, MESITA-4702: "blue for prepayments
// and green for cashbacks · Pay (X% Cashback) · Prepay (Up to X% Bonus)"):
// a green Pay slide where a bill earns cashback, then the blue Prepay slide.
const OFFER_SLIDES: OfferSlide[] = [
  { key: "cashback", lead: "Pay", pill: "", pillShort: "", short: "Pay", spoken: "Pay", section: "cashback", tone: GREEN },
  // The best standard voucher on sale (offerSlides picks it).
  // "Prepay" on the previews since MESITA-4255 (Pato: "instead of classic use
  // the word prepay. its just clearer"); the Offers page keeps its "Classic
  // Offers" and "Special Offers" panels.
  { key: "prepay", lead: "Prepay", pill: "", pillShort: "", short: "Prepay", spoken: "Prepay", section: "prepayment", tone: BLUE },
  // POST, THIRD (MESITA-4714): "Post · $20 Story" where a story pays.
  { key: "post", lead: "Post", pill: "", pillShort: "", short: "Post", spoken: "Post", section: "post", tone: PINK },
  // No Welcome voucher slide since MESITA-4698: Welcome is a cashback line.
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
    if (s.key === "cashback") {
      const { pct, flat } = cashbackOf(offers);
      if (pct <= 0) return [];
      const words = `${flat ? "" : "Up to "}${pct}% Cashback`;
      return [{ ...s, pill: words, pillShort: `${pct}% Cashback`, spoken: `Pay, ${words.toLowerCase()}` }];
    }
    if (s.key === "prepay")
      // "Up to 30% Bonus", lower-case "to", no "+" (Pato, MESITA-4702). The
      // renderer's own "Up To" prefix (MESITA-4676) went: the words live here.
      return top ? [{ ...s, pill: `Up to ${top[1]}% Bonus`, pillShort: `${top[1]}% Bonus`, spoken: `Prepay, up to ${top[1]}% bonus`, bonus: top[1], voucher: top[0] }] : [];
    if (s.key === "post") {
      const cents = storyOf(offers);
      if (cents <= 0) return [];
      const words = "$" + String(Math.round(cents / 100)) + " Story";
      return [{ ...s, pill: words, pillShort: words, spoken: "Post, " + words.toLowerCase() }];
    }
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
