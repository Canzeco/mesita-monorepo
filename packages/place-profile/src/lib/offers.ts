// THE OFFER SLIDES' WORDS (MESITA-4151): plain data, no React, so the row's
// state and its tests read them without a renderer. The beat and the moving
// track are components/place-detail/offer-slides.tsx.

import type { RewardsSection } from "../rewards-section";
import type { MoneyVoucherKey } from "../money-state";

/** One offer on the moving button (MESITA-3467). */
export type OfferSlide = {
  key: string;
  /** The words before the ink pill. */
  lead: string;
  pill: string;
  /** The pill where room is short (Pato, 2026-11-23, MESITA-4709: "if not
   *  enough space, don't mention the full offer like UP TO X%"): no leading
   *  "Up to", so "10% Back", "30% Bonus". The place screen's Offers tile
   *  and the narrow cards read it; wide pills keep `pill`. */
  pillShort: string;
  /** The place screen's chip: the word with its percent, the kind under it
   *  (Pato, 2026-11-24, MESITA-4853): PAY 5% over CASHBACK. */
  stacked?: { top: string; under: string };
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
  /** A list row's lines in whole percent (null = that line gives nothing),
   *  for the range (MESITA-5093). */
  welcome_pct?: number | null;
  returning_pct?: number | null;
  /** The place screen's money read carries the lines themselves (PlaceMoney). */
  cashback?: {
    welcome_bps: number;
    returning_bps: number;
    returning_vip_bps?: number;
    /** MESITA-4789: a VIP guest's first bill here. */
    welcome_vip_bps?: number;
    /** The line this guest's next bill falls in (null signed out). */
    line?: "welcome" | "welcome_vip" | "returning" | "returning_vip" | null;
  } | null;
  /** MESITA-4764: each voucher's bonus at this place in whole percent (a
   *  list row's field, the owner's pick); absent reads STANDARD_BONUS. */
  voucher_pct?: Partial<Record<string, number>> | null;
};

/** THE RANGE (Pato, 2026-11-27, MESITA-5093: "mention the ranges because we
 *  have welcome and returning"): the lowest and highest line that is on, in
 *  whole percent. Welcome and Returning only; the VIP lines are retired
 *  (MESITA-5072). A row with only cashback_pct reads one rate. */
function cashbackRange(o: OfferInput): [number, number] | null {
  const c = o.cashback;
  const lines = c
    ? [c.welcome_bps / 100, c.returning_bps / 100]
    : o.welcome_pct !== undefined || o.returning_pct !== undefined
      ? [o.welcome_pct ?? 0, o.returning_pct ?? 0]
      : o.cashback_pct != null ? [o.cashback_pct] : [];
  const on = lines.filter((n) => n > 0);
  return on.length ? [Math.min(...on), Math.max(...on)] : null;
}

/** "5% to 10%", or "10%" when the two ends meet; `plus` adds the bonus's "+". */
function rangeWords([lo, hi]: [number, number], plus = false): string {
  const p = plus ? "+" : "";
  return lo === hi ? `${p}${hi}%` : `${p}${lo}% to ${p}${hi}%`;
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
// Blue left with MESITA-4748: Prepay is green again.
// Post's pink went with Stories (MESITA-4766).
// ONE COLOUR PER OFFER, EVERYWHERE (Pato, 2026-11-23, MESITA-4748,
// /plan-design-review D9): Prepay green, Pay purple, the Wallet's
// two tiles' colours, so a colour means the same thing on Home, the place
// screen and Pay. Vouchers blue and cashback green before (MESITA-4701/4702).
// DISCOUNT GREEN, CASHBACK RED-PINK, PREPAY BLUE (Pato, 2026-11-23,
// MESITA-4770: "descuentos en verde, cashback en rosa rojizo y prepagos en
// azul", the type's name always beside the colour). Supersedes MESITA-4748's
// Prepay green / Pay purple. Cashback's red-pink is a coral, apart from
// Post's bubblegum #FF66C4 and Reserve's red. Black ink on all three.
// PREPAY GREEN, CASHBACK BLUE, DISCOUNT RED (Pato, 2026-11-23, MESITA-4777:
// "make prepay green and cashback blue and discount red"): swaps the three
// above the same day. Black ink on all three.
// PREPAY PURPLE, PAY GREEN, ALWAYS (Pato, 2026-11-24, MESITA-4840: "all prepay
// buttons must be purple like stripe (since prepayments are done via stripe)
// and all pay buttons must be green"; discount or cashback, it doesn't matter).
const PURPLE = "bg-[#635BFF] text-white";
export const VOUCHER_TONE: Record<MoneyVoucherKey, string> = {
  voucher_welcome: PURPLE,
  voucher_200: PURPLE,
  voucher_1000: PURPLE,
  voucher_5000: PURPLE,
  voucher_vip: PURPLE,
};
/** Every cashback line, Pay's green (MESITA-4840; blue under MESITA-4777). */
export const CASHBACK_TONE = GREEN;
// THE WORDS (Pato, 2026-11-17, MESITA-4219): Classic, the best standard
// voucher, leads; every pill reads "+N% Bonus" on every screen (the "+"
// back, MESITA-4221). Prepay led with "+N%" before.
// PAY, THEN PREPAY (Pato, 2026-11-22, MESITA-4702: "blue for prepayments
// and green for cashbacks · Pay (X% Cashback) · Prepay (Up to X% Bonus)"):
// a green Pay slide where a bill earns cashback, then the blue Prepay slide.
const OFFER_SLIDES: OfferSlide[] = [
  { key: "cashback", lead: "Pay", pill: "", pillShort: "", short: "Pay", spoken: "Pay", section: "cashback", tone: CASHBACK_TONE },
  // The best standard voucher on sale (offerSlides picks it).
  // "Prepay" on the previews since MESITA-4255 (Pato: "instead of classic use
  // the word prepay. its just clearer"); the Offers page keeps its "Classic
  // Offers" and "Special Offers" panels.
  { key: "prepay", lead: "Prepay", pill: "", pillShort: "", short: "Prepay", spoken: "Prepay", section: "prepayment", tone: PURPLE },
  // No Welcome voucher slide since MESITA-4698: Welcome is a cashback line.
];

/** The standard vouchers' default bonuses: the server's catalog (supabase
 *  _shared/money.ts VOUCHER_CATALOG: Small +10%, Medium +20%, Big +30%;
 *  MESITA-4980). Each place picks its own (Small 10 · 20, Medium 20 · 40,
 *  Big 30 · 60): `voucherPct` reads the row's pick first. */
export const STANDARD_BONUS: Record<string, number> = {
  voucher_200: 10,
  voucher_1000: 20,
  voucher_5000: 30,
};

/** A voucher's bonus at this place in whole percent: the row's pick, else
 *  the catalog default. */
export function voucherPct(offers: Pick<OfferInput, "voucher_pct"> | null | undefined, key: string): number {
  return offers?.voucher_pct?.[key] ?? STANDARD_BONUS[key] ?? 0;
}

/** The place's slides, in the fixed order; none = nothing to show. */
export function offerSlides(offers: OfferInput | null | undefined): OfferSlide[] {
  if (!offers) return [];
  const sell = new Set(offers.sell);
  const standard = Object.keys(STANDARD_BONUS).filter((key) => sell.has(key)).map((key): [string, number] => [key, voucherPct(offers, key)]);
  const top = standard.reduce<[string, number] | null>((a, b) => (a && a[1] >= b[1] ? a : b), null);
  return OFFER_SLIDES.flatMap((s): OfferSlide[] => {
    if (s.key === "cashback") {
      const range = cashbackRange(offers);
      if (!range) return [];
      // "BACK", NOT "CASHBACK" (Pato, 2026-11-27, MESITA-5092: "don't
      // mention cashback, mention back. its more honest"). The range of
      // the lines that are on (MESITA-5093): "5% to 10% Back".
      const word = "Back";
      const words = `${rangeWords(range)} ${word}`;
      return [{ ...s, tone: CASHBACK_TONE, pill: words, pillShort: words, stacked: { top: `Pay ${rangeWords(range)}`, under: word }, spoken: `Pay, ${words.toLowerCase()}` }];
    }
    if (s.key === "prepay") {
      if (!top) return [];
      // THE RANGE (Pato, 2026-11-27, MESITA-5093: "Prepay +10% to +30%
      // Bonus … there are multiple offers, so mention the ranges"): the
      // lowest to the highest bonus of the vouchers sold here. "Up to 30%
      // Bonus" under MESITA-4702.
      const range: [number, number] = [Math.min(...standard.map(([, n]) => n)), top[1]];
      const words = `${rangeWords(range, true)} Bonus`;
      return [{ ...s, pill: words, pillShort: words, stacked: { top: `Prepay ${rangeWords(range, true)}`, under: "Bonus" }, spoken: `Prepay, ${words.toLowerCase()}`, bonus: top[1], voucher: top[0] }];
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
