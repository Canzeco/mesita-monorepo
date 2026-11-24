"use client";

import { type ComponentType, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BadgePlus, Receipt as ReceiptIcon, Check, ChevronDown, CircleCheck, Clock, CreditCard, Crown, Gift, Info, Infinity as InfinityIcon, Lock, Minus, PartyPopper, Plus, QrCode, Repeat, Ticket, Utensils, Wallet, X, type LucideIcon } from "lucide-react";
import { isCardExpired, type PayCards } from "../../pay-cards";

import type { PlaceActions, VoucherBasketItem } from "../../actions";
import { cn } from "../../lib/format";
import { VOUCHER_TONE, visitMechanismOf, visitTone, visitWord, type VisitMechanism } from "../../lib/offers";
import { MONEY_VOUCHER_KEYS, moneyState, type MoneyVoucherKey, NOT_YET_SELLABLE, VIP_MIN_FOLLOWERS, type VoucherReason } from "../../money-state";
import type { PlaceCashback, PlaceDetail, VoucherCatalogLine } from "../../place-detail";

// THE VOUCHERS TAB IS SIX DIGITAL PRODUCTS IN ONE VERTICAL LIST (Pato,
// MESITA-3309: "Make the Vouchers graphics. It must look like 6 digital
// products"; then MESITA-3310, with the two shelves scrolling sideways:
// "Make the vouchers vertical, not scrollable horizontally. Just a list of
// 6 items vertical"). The six vouchers are one catalog on the server
// (VOUCHER_CATALOG, MESITA-3302) and the six cards Business › Payments draws
// (MESITA-3298): Standard MX$200 · MX$1,000 · MX$5,000 and VIP, each with the same mark and colour on both sides (one mark
// everywhere). A guest sees them as A CATALOG (Pato, MESITA-3323: "make a
// catalog, like it must feel e commerce like products"; MESITA-3326: "use
// vertical list catalog with e-commerce vibes here. Not 2*3 but 1*6"): six
// full-width product cards stacked down the page (the 2×3 grid lasted an
// hour; MESITA-3310's card of rows read boring), specials first: each card
// a square face on the left, the mark big on its colour with the bonus in
// a corner, and on the right the price as the product's name, the credit it
// buys in one objective line (Pato: "be super objective"), the condition,
// how many a guest can have (MESITA-3328, Pato: "mention the inventory,
// like one or renews each visit"), and Buy or the tag. SPECIALS FIRST
// (MESITA-3328, Pato: "Welcome, Instagram, VIP, normal shit then"). The
// titles are Title Case, Pato's spelling (MESITA-3328: "Pre-Payment
// Promos", "Payment Promos"), over the screen's sentence
// case. THE STANDARD THREE SHARE ONE MARK AND ONE COLOUR, the
// wallet on emerald (MESITA-3326, Pato: "the standard deals/promos must
// have the same icon and the same color"); VIP keeps its own. Under the title, one
// line reads "Pay $X · Get $Y"; the (i) says what the guest paid is ready at
// once and the bonus 3 hours later, every voucher (MESITA-4214; one hour for
// all of it from MESITA-3323).
// PREPAYMENTS ONLY (Pato, 2026-11-15, MESITA-4062: "remove payments from the
// prepayments page. it is confusing. just leave prepayments offerings
// there"): the Payments card is gone. Nothing scrolls sideways.
//
// Every row is always there, so the tab never reads as empty and never
// pretends: a voucher this place sells is lit and carries Buy (MESITA-3303),
// and one it does not (the owner's switch off, no Stripe account, not
// sellable by any wave yet, sales paused, or Welcome already had) is dimmed
// with one tag. The server decides which is which: `place.money.sell` from
// consumer-web-list-vouchers (moneyState's twin plus the kill switch and
// Welcome-once); a read with no `sell` (an older EF, a Google-only card)
// falls back to moneyState alone, with nothing for sale. The numbers on a
// row are the server's catalog when the read carries one, else the copy
// here; this file formats cents and never adds. The guest's credit here
// leads the tab when they have any; the TestBand leads everything while
// Stripe is in test mode.
//
// decision: the marks carry colour on an achromatic screen (MESITA-2636): a
// voucher is a product with its own face, as a brand's logo is, and the same
// face the owner sees on Payments.

//
// A LIST LIKE INKIND'S (Pato, MESITA-3397, with inKind's "Load your wallet"
// screen: "more like this"; MESITA-3397 before it: "make the text clearer,
// Pay X, Get Y. easy peasy."): one card of rows split by hairlines, each row
// a radio, the deal in one line, "Pay MX$100, Get MX$130", the name and the
// limit small under it, and the bonus as a green pill on the right. ONE Buy
// under the card buys the chosen row; the first row for sale starts chosen.
// The coloured product faces of MESITA-3347 went: the screen is the list.

//
// PREPAYMENT OFFERS (MESITA-3446): the vouchers as cards that swipe
// sideways (snap), specials first; each card
// is the name and its bonus pill, Pay over Get with Get big in green, the
// limit, and its own Buy. The radio list and its one Buy went. A voucher not
// for sale keeps its card, dimmed outside test mode, its tag where Buy goes.

type Product = {
  key: MoneyVoucherKey;
  /** The product's name, small under the deal. */
  name: string;
  /** What the guest gets, in one line (the copy when the read has no catalog). */
  line: string;
  /** The condition, when the voucher has one. */
  when?: string;
  /** How many a guest can have (Pato, MESITA-3328: "mention the inventory"). */
  limit: string;
  bonus: string;
  /** The card's title in a three-across row (MESITA-3451). */
  short: string;
  /** The card's limit in a three-across row. */
  brief: string;
};

// SMALL, MEDIUM AND BIG VOUCHER SINCE MESITA-3452 (Pato: "rename the other
// packages to small voucher, medium voucher, big voucher ... welcome
// voucher"); Standard, Standard Medium, Standard Large before.
// THE STANDARD THREE ARE NAMED, NOT PRICED (Pato, MESITA-3362): the deal
// line carries the amounts.
const STANDARD: Product[] = [
  // SMALL · MEDIUM · BIG (Pato, 2026-11-15, MESITA-4056): MX$200 +10%,
  // MX$500 +20% (the voucher_5000 key), MX$1,000 +30%. EACH KEY ITS PRICE
  // (Pato, 2026-11-16, MESITA-4152): Small MX$200 +10%, Medium MX$1,000 +20%
  // (voucher_1000), Big MX$5,000 +30% (voucher_5000). THE FULL NAME ON
  // EVERY ROW (Pato, 2026-11-23, MESITA-4737: "call them Small Voucher,
  // Medium Voucher, Big Voucher"): `short` reads the same as `name` now.
  { key: "voucher_200", name: "Small Voucher", line: "Pay $200.00MX, get $220.00MX.", limit: "As many as you like.", bonus: "10% bonus", short: "Small Voucher", brief: "As many as you like" },
  { key: "voucher_1000", name: "Medium Voucher", line: "Pay $1,000.00MX, get $1,200.00MX.", limit: "As many as you like.", bonus: "20% bonus", short: "Medium Voucher", brief: "As many as you like" },
  // MESITA-4764: the place picks each bonus (Small 10 · 20, Medium 20 · 40,
  // Big 40 · 60); this copy is the default, the server's catalog line wins.
  { key: "voucher_5000", name: "Big Voucher", line: "Pay $5,000.00MX, get $7,000.00MX.", limit: "As many as you like.", bonus: "40% bonus", short: "Big Voucher", brief: "As many as you like" },
];

// SPECIAL OFFERS: WELCOME, THEN VIP (Pato, 2026-11-22, MESITA-4645: "RETURN
// THE WELCOME BONUS. WELCOME AND THEN THE OTHER BONUSES."). Welcome is once
// per guest per place. VIP IS BACK (MESITA-4640): MESITA-4249's deal, the VIP
// class only, one each new visit.
const SPECIAL: Product[] = [
  { key: "voucher_welcome", name: "Welcome", line: "Pay $100.00MX, get $200.00MX.", limit: "One per place.", bonus: "100% bonus", short: "Welcome", brief: "One per place" },
  { key: "voucher_vip", name: "VIP", line: "Pay $100.00MX, get $200.00MX.", limit: "One per visit.", bonus: "100% bonus", short: "VIP", brief: "VIP only · One per visit" },
];

/** "$1,200.00MX" from cents: always two decimals (MESITA-3767). Formatting
 *  only, never arithmetic. */
export function pesos(cents: number, currency: string): string {
  const code = currency.toUpperCase();
  const c = Math.round(cents);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      // Yen and Chilean pesos have no cents (MESITA-3923).
      minimumFractionDigits: code === "JPY" || code === "CLP" ? 0 : 2,
      maximumFractionDigits: code === "JPY" || code === "CLP" ? 0 : 2,
    }).format(c / 100).replace(/^(-?)\$(.*)$/, code === "MXN" ? "$1$$$2MX" : "$1$$$2");
  } catch {
    return `${(c / 100).toFixed(2)} ${code}`;
  }
}

/** The credit: the server's, else from the copy. */
function creditValue(product: Product, line: VoucherCatalogLine | undefined, currency: string): string {
  if (line) return pesos(line.credit_cents, currency);
  const m = /get (\$[\d,.]+MX)/.exec(product.line);
  return m ? m[1] : product.name;
}
/** The bonus tag, "+20%": the server's line (the place's pick, MESITA-4764),
 *  else the copy. */
function bonusValue(product: Product, line: VoucherCatalogLine | undefined): string {
  if (line && line.price_cents > 0) return `+${Math.round((line.bonus_cents * 100) / line.price_cents)}%`;
  return `+${product.bonus.replace(/ bonus$/, "")}`;
}
/** What a guest pays: the server's, else from the copy. */
function priceValue(product: Product, line: VoucherCatalogLine | undefined, currency: string): string {
  if (line) return pesos(line.price_cents, currency);
  const m = /Pay (\$[\d,.]+MX)/.exec(product.line);
  return m ? m[1] : product.name;
}

/** One tag per state, objective: where it stands for this guest at this place. */
function tag(reason: VoucherReason | undefined): string {
  if (!reason) return "Available here";
  if (reason === "off" || reason === "needs_account" || reason === "needs_loyalty_cards" || reason === "needs_billing") return "Not at this place yet";
  if (reason === "paused") return "Paused for a moment";
  if (reason === "used") return "You had yours here";
  if (reason === "needs_visit") return "One per visit";
  return "Coming soon";
}


/** A section title on the one-screen Offers page: 16px (MESITA-3452). */
// The Panel heading's face since MESITA-4196 (16px display, as the Reserve page).
const OFFERS_TITLE_CLASS = "text-foreground text-base leading-tight font-semibold tracking-tight";

/** A card: one hairline edge, white, rounded. */
const CARD = "border-border bg-card rounded-2xl border";

/** A voucher's face (MESITA-3466, Pato: "different colors. insta must be
 *  insta color and background. welcome must be blue. vip must be golden.
 *  standard must be black"): the card, its words, its pill and its Buy. */
type Face = {
  card: string;
  muted: string;
  /** The big bonus number's ink (green on the black cards). */
  big: string;
  buy: string;
  Mark?: LucideIcon;
};
// LIGHT FACES, BLACK WORDS (MESITA-3480, Pato: "standardize the colors, all
// the boxes must have the same black letters, thus make them lighter, and the
// standard prepayment options must be green, not black"): one ink on every
// card, a light tint per voucher, a black Buy. Solid since MESITA-3471.
const LIGHT = { muted: "text-neutral-950/60", big: "", buy: "bg-neutral-950 text-white" };
const FACES: Record<MoneyVoucherKey, Face> = (() => {
  // EVERY ROW WEARS A MARK (Pato, MESITA-3835: "either all with icons or
  // none with icons"): the sized vouchers share the ticket.
  const green: Face = { card: VOUCHER_TONE.voucher_200, ...LIGHT, Mark: Ticket };
  return {
    // The party popper tells Welcome apart; green like every offer (MESITA-4645).
    voucher_welcome: { ...green, card: VOUCHER_TONE.voucher_welcome, Mark: PartyPopper },
    voucher_200: green,
    voucher_1000: green,
    voucher_5000: green,
    // The crown tells VIP apart; green like every offer (MESITA-4640).
    voucher_vip: { ...green, card: VOUCHER_TONE.voucher_vip, Mark: Crown },
  };
})();


/** A locked offer's status line (MESITA-3502), the sheet's reason since
 *  MESITA-4224. */
type InfoStatus = { ok: boolean; text: string };

/** The black button stays clean: no MX there, only on the rows (MESITA-3499,
 *  Pato: "don't mention MX below, just on the select"). */
function noMx(v: string): string {
  return v.replace(/MX$/, "");
}

/** "$100" for "$100.00MX" (MESITA-4186): the rows' whole amounts drop the
 *  cents and the MX; an amount with cents keeps them. Formatting only. */
function whole(v: string): string {
  return noMx(v).replace(/\.00$/, "");
}

/** ALL OF IT IN 3 HOURS (Pato, 2026-11-23, MESITA-4717: "Pay X, Wait 3
 *  hours, Receive Y (you now receive all in one run)"): every voucher. The
 *  row and the button say only "Pay $X · Get $Y"; the steps say when. Your
 *  money now and the bonus later was MESITA-4214. */
const READY_IN = "all in 3 hr";

/** The (i)'s "Your status" line for a prepayment offer (MESITA-3502). */
function offerStatus(
  key: MoneyVoucherKey,
  can: boolean,
  lock: GuestLock,
  reason: VoucherReason | undefined,
  guest?: PlaceActions["guest"],
): InfoStatus {
  // VIP ONLY (MESITA-4640): the bar, then the guest's own facts, objective,
  // never "you need N more" (design review).
  if (lock === "vip") {
    // Any Instagram counts, public or private (MESITA-4659); an invitation
    // code makes a VIP too (MESITA-4766).
    const bar = `For VIP: an invitation code, or an Instagram with more than ${VIP_MIN_FOLLOWERS.toLocaleString("en-US")} followers.`;
    if (!guest?.instagramLinked || guest.instagramFollowers == null) return { ok: false, text: bar };
    return { ok: false, text: `${bar} Yours: ${guest.instagramFollowers.toLocaleString("en-US")} followers.` };
  }
  if (can) {
    if (key === "voucher_welcome") return { ok: true, text: "Available. Once per guest at this place." };
    if (key === "voucher_vip") return { ok: true, text: "Available. One per visit." };
    return { ok: true, text: "Available. Buy as many as you like." };
  }
  if (reason === "used") return { ok: false, text: "You already had yours here." };
  // MESITA-3463: a visit is a paid bill here with a card part.
  if (reason === "needs_visit") return { ok: false, text: "One per visit. Pay a bill here by card to buy another." };
  return { ok: false, text: `${tag(reason)}.` };
}

/** The Offers page (MESITA-3412: the host's sheet off Prepay; it was the
 *  fourth tab). Prepayments only since MESITA-4062. */
type GuestLock = "vip" | null;

/** Who may buy what, once for every list of the six vouchers (VouchersPane,
 *  and the Loyalty Card's Vouchers via voucherOffers, MESITA-3822). */
function offerRules(money: PlaceDetail["money"], guest: PlaceActions["guest"]) {
  // A Google-only card or an older read has no money: every switch reads off.
  // Only `unavailable` is valid from this local call: the read strips
  // `pay_cards`, so its mesita_pay is not the server's.
  const state = moneyState(
    {
      // Loyalty Cards as the server says; an older read without it is
      // read as on, so the server's own unavailable reasons stand.
      loyalty_cards: money?.loyalty_cards !== false,
      voucher_welcome: money?.vouchers.voucher_welcome === true,
      voucher_200: money?.vouchers.voucher_200 === true,
      voucher_1000: money?.vouchers.voucher_1000 === true,
      voucher_5000: money?.vouchers.voucher_5000 === true,
      voucher_vip: money?.vouchers.voucher_vip === true,
    },
    money ? { charges_enabled: money.charges_enabled } : null,
    null,
  );
  // What sells is the server's word (`sell`, with the kill switch and
  // the guest's own limits applied); a read without it sells nothing.
  const unavailable: Partial<Record<MoneyVoucherKey, VoucherReason>> = { ...state.unavailable };
  for (const k of state.sell) {
    if (!money?.sell.includes(k)) unavailable[k] = money?.unavailable[k] ?? "needs_account";
  }
  // IN TEST MODE NOTHING IS GREYED (Pato, MESITA-3334); live mode dims a row
  // not for sale.
  const dim = money?.test_mode !== true;
  // THE GUEST'S OWN LOCK: only VIP has one.
  const guestLock = (k: MoneyVoucherKey): GuestLock => {
    // VIP only (MESITA-4640): anyone not known to be VIP sees it locked; the
    // buy door refuses a non-VIP whatever this says.
    if (k === "voucher_vip" && guest?.guestClass !== "vip") return "vip";
    return null;
  };
  // Buyable: the server sells it, in every mode (MESITA-4399: in test mode
  // MESITA-3342 let any row through, so a voucher the place switched off
  // showed Pay and no Apple Pay / Google Pay, and every buy was refused).
  // Test mode still greys nothing (`dim`).
  const buyable = (k: MoneyVoucherKey) => {
    if (guestLock(k)) return false;
    // A parked voucher (NOT_YET_SELLABLE, none today) is shown but stays
    // locked; the server refuses the buy (MESITA-4220).
    if (NOT_YET_SELLABLE[k]) return false;
    return unavailable[k] === undefined;
  };
  // HIDDEN · BLOCKED · AVAILABLE (Pato, 2026-11-21, MESITA-4603: "If not
  // available by the business, don't put it as offer ... never mention
  // welcome twice ... ONLY HID IT IF THE BUSINESS DON'T OFFER IT ... BUT IF
  // AVAILABLE, JUST BLOCKED"). Reverses MESITA-4220's
  // "every voucher, locked or not". Docs › Credits has the table.
  const show = (k: MoneyVoucherKey): OfferShow => {
    const reason = unavailable[k];
    // The place doesn't offer it (switched off, no account, Loyalty Cards
    // off, billing past due, card payments off, not yet sellable): gone.
    if (reason !== undefined && !GUEST_SIDE_REASONS.has(reason)) return "hidden";
    // Welcome is once per place: once had, it is never shown again.
    if (k === "voucher_welcome" && reason === "used") return "hidden";
    return buyable(k) ? "available" : "blocked";
  };
  return { unavailable, dim, guestLock, buyable, show };
}

/** How a voucher stands on the Offers page for this guest (MESITA-4603). */
export type OfferShow = "hidden" | "blocked" | "available";

/** The reasons that are the guest's, or a pause, never the place's: the row
 *  stays and reads blocked. Every other reason means the place doesn't offer
 *  it, and the row is hidden (MESITA-4603). */
const GUEST_SIDE_REASONS: ReadonlySet<VoucherReason> = new Set<VoucherReason>(["used", "needs_visit", "needs_instagram", "paused"]);

/** One of the six vouchers as a row elsewhere (the Loyalty Card, MESITA-3822):
 *  the Offers page's own words, colour and rules, formatted, never added. */
export type VoucherOffer = {
  key: MoneyVoucherKey;
  /** "Small" … "VIP" (MESITA-4206; "Small Bonus" … before). */
  title: string;
  /** The chip's tint and ink (the voucher's face). */
  chipClass: string;
  /** "+10%". */
  bonus: string;
  pay: string;
  get: string;
  /** "all in 3 hr" (MESITA-4717; "bonus in 3 hr" since MESITA-4214). */
  ready: string;
  /** This guest can buy it now. */
  buyable: boolean;
  /** Not buyable and drawn dimmed (live mode). */
  dimmed: boolean;
  /** Why not, in one short line, when it is not buyable. */
  why: string | null;
};

/** The Offers page's voucher list: TWO PANELS BY HOW MANY YOU CAN BUY
 *  (Pato, 2026-11-16, MESITA-4203: "both are prepayments ... IDK" → "Yes,
 *  rename"): SPECIAL OFFERS (Welcome once per place, VIP one per
 *  visit), then CLASSIC OFFERS, the three sizes, as many as you like (Pato,
 *  2026-11-17, MESITA-4218: "Classic Offers · Special Offers"; Standard Offers
 *  in MESITA-4216; Limited and
 *  Unlimited Vouchers in MESITA-4203).
 *  What the guest paid and the bonus land together 3 hours later (MESITA-4717).
 *  Instant / Prepayment Vouchers in MESITA-4198. One "Prepaid Vouchers" group from MESITA-4173,
 *  Special and Bonus Vouchers in MESITA-4154. The host still opens it by
 *  `?rewards=prepayment` or `?rewards=special`. */
// SPECIAL OFFERS · CLASSIC OFFERS (Pato, 2026-11-22, MESITA-4645: "classic
// offers and special offers"; "WELCOME AND THEN THE OTHER BONUSES"): Special
// first, Welcome then VIP; Classic under it, Small, Medium, Big. Replaces
// MESITA-4640's Regular Offers · VIP Offers. A section with no row to show
// (the place offers none of it) is not drawn.
const GROUPS: { id: "special" | "prepayment"; title: string; keys: ReadonlySet<MoneyVoucherKey> }[] = [
  {
    id: "special",
    title: "Special Offers",
    keys: new Set(["voucher_welcome", "voucher_vip"]),
  },
  {
    id: "prepayment",
    // MESITA-4698 (Pato: "we must have Vouchers and we must have Coupons
    // as Offers"): the panels are Cashback, then Vouchers.
    title: "Vouchers",
    keys: new Set(["voucher_200", "voucher_1000", "voucher_5000"]),
  },
];

/** The vouchers a guest is shown: EVERY ONE, LOCKED OR NOT (Pato,
 *  2026-11-17, MESITA-4220: "DISPLAY VIP EVEN IF BLOCKED"). A voucher not on
 *  sale yet (money-state's VIP today) is a locked row, never
 *  a missing one; it was dropped from the page from MESITA-3831. */
function listedProducts(): Product[] {
  // Welcome, VIP, then Small, Medium, Big (MESITA-4645: the specials lead;
  // no Story since MESITA-4641).
  return [...SPECIAL, ...STANDARD];
}

/** The vouchers in the Offers page's order, Welcome · VIP · Small · Medium ·
 *  Big (MESITA-4645). */
export function voucherOffers(money: PlaceDetail["money"], guest?: PlaceActions["guest"]): VoucherOffer[] {
  const { unavailable, dim, guestLock, buyable, show } = offerRules(money, guest);
  const catalog = money?.catalog ?? {};
  const currency = money?.currency ?? "mxn";
  return listedProducts().filter((p) => show(p.key) !== "hidden").map((p) => {
    const line = catalog[p.key];
    const can = buyable(p.key);
    const status = offerStatus(p.key, can, guestLock(p.key), unavailable[p.key], guest);
    return {
      key: p.key,
      title: p.short,
      chipClass: FACES[p.key].card,
      bonus: bonusValue(p, line),
      pay: priceValue(p, line, currency),
      get: creditValue(p, line, currency),
      ready: READY_IN,
      buyable: can,
      dimmed: !can && dim,
      why: can ? null : status.text.replace(/\.$/, ""),
    };
  });
}

/** "6:40 pm", or "Tue 6:40 pm" when it is not today (MESITA-4224). */
export function readyClock(iso: string, now = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const time = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
  return at.toDateString() === now.toDateString() ? time : `${at.toLocaleDateString("en-US", { weekday: "short" })} ${time}`;
}

/** HOW IT WORKS, IN THREE STEPS (Pato, 2026-11-17, MESITA-4299: "Write all
 *  the steps clearer ... 1. Pay X 2. Receive principal right now 3. Receive
 *  bonus in 3 hours. JUST THIS 3 STEPS"): each step is one thing that
 *  happens, its amount on the right of a bold line and one small line under
 *  it; the bonus step in green. Where the credit spends and that it never
 *  expires is one line under the steps, never a step. The Right now · In 3
 *  hours · Anytime labels were MESITA-4290; each special's own first step
 *  MESITA-4234; four grey bullets MESITA-4224. */
type Step = {
  Icon: LucideIcon;
  title: string;
  /** The money this step moves, on the right of the title. */
  amount?: string;
  line: ReactNode;
  green?: boolean;
  /** The Credits step lights the step the guest is on and ticks the one done. */
  state?: "current" | "done";
  /** The word under the icon when the steps run across (MESITA-4635). */
  short?: string;
};

const SECTION_LABEL = "text-muted-foreground text-xs leading-tight font-bold tracking-wider uppercase";

/** THE STEPS RUN ACROSS (Pato, 2026-11-21, MESITA-4635: "steps of this
 *  must be horizontal similar to visits steps"): one column per step, a
 *  round icon on a line joining the next, the step's short word, its amount
 *  and one small line under it; the bonus in green. Down the sheet before. */
function StepList({ steps, dim }: { steps: Step[]; dim?: boolean }) {
  return (
    <ol
      className={cn("grid gap-2", dim && "opacity-50")}
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      aria-label="How it works"
      data-offer-steps
    >
      {steps.map((s, i) => (
        <li key={s.title} className="flex min-w-0 flex-col items-center text-center" aria-current={s.state === "current" ? "step" : undefined} data-offer-step={s.state}>
          <span className="relative flex w-full justify-center" aria-hidden>
            {i < steps.length - 1 ? <span className="bg-border absolute top-1/2 left-1/2 h-0.5 w-[calc(100%+0.5rem)]" /> : null}
            <span
              className={cn(
                "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                s.state === "current"
                  ? "bg-foreground text-paper"
                  : s.state === "done"
                    ? "bg-[#E9FBF1] text-[#00A85A]"
                    : s.green
                      ? "bg-[#00D66F] text-neutral-950"
                      : "bg-muted text-foreground",
              )}
            >
              {s.state === "done" ? <Check className="h-5 w-5" strokeWidth={2.75} /> : <s.Icon className="h-5 w-5" strokeWidth={2.25} />}
            </span>
          </span>
          <span className={cn("mt-2 text-sm leading-tight font-bold", s.green ? "text-[#00A85A]" : "text-foreground")}>{s.short ?? s.title}</span>
          {s.amount ? <span className={cn("mt-0.5 text-sm font-bold tabular-nums", s.green ? "text-[#00A85A]" : "text-foreground")}>{s.amount}</span> : null}
          <span className="text-muted-foreground mt-1 text-xs leading-snug">{s.line}</span>
        </li>
      ))}
    </ol>
  );
}

/** A WHITE BOX ON THE GREY GROUND (Pato, 2026-11-17, MESITA-4303: "MORE
 *  MODULAR ... IN BOXES ... ONE BOX FOR THE STEPS AND ONE BOX FOR THE
 *  EXPLANATION ... KEEP THIS ORDERED"; D2): the Reserve page's panel, its
 *  small label inside, one job per box. */
function Box({
  title,
  className,
  children,
  ...data
}: { title?: string; className?: string; children: ReactNode } & { [k: `data-${string}`]: string | undefined }) {
  return (
    <section className={cn(CARD, "shrink-0 px-4 py-3", className)} {...data}>
      {title ? <h4 className={cn(SECTION_LABEL, "mb-2.5")}>{title}</h4> : null}
      {children}
    </section>
  );
}

/** One line of a Good to know box. */
type Fact = { Icon: LucideIcon; text: string };

function GoodToKnow({ facts }: { facts: Fact[] }) {
  return (
    <Box title="Good to know" data-offer-good-to-know="">
      <ul className="flex flex-col gap-2">
        {facts.map((f) => (
          <li key={f.text} className="text-foreground flex items-start gap-2.5 text-base leading-snug">
            <f.Icon className="text-muted-foreground mt-0.5 h-[18px] w-[18px] shrink-0" strokeWidth={2.25} aria-hidden />
            {f.text}
          </li>
        ))}
      </ul>
    </Box>
  );
}

/** Every offer of a tab inside How it works (MESITA-4804): its name, what it
 *  asks, its own rule, and its rate at the right. */
function OfferFacts({ rows }: { rows: { key: string; title: string; line: string; rule?: string | null; rate: string }[] }) {
  return (
    <Box title="Offers" data-how-offers="">
      <ul className="divide-border divide-y">
        {rows.map((o) => (
          <li key={o.key} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0" data-how-offer={o.key}>
            <span className="min-w-0">
              <span className="text-foreground block text-base leading-snug font-semibold">{o.title}</span>
              <span className="text-muted-foreground block text-sm tabular-nums">{o.line}</span>
              {o.rule ? <span className="block text-sm font-semibold text-amber-900">{o.rule}</span> : null}
            </span>
            <span className="text-foreground shrink-0 text-base leading-snug font-semibold tabular-nums">{o.rate}</span>
          </li>
        ))}
      </ul>
    </Box>
  );
}

/** THE MOST OF ONE VOUCHER IN A BASKET (MESITA-4647): the server's own caps
 *  (`_shared/vouchers.ts` BASKET_MAX_QTY 5; BASKET_ONE_ONLY Welcome and VIP
 *  1). The server refuses past them whatever this says. */
export const BASKET_MAX: Record<MoneyVoucherKey, number> = {
  voucher_welcome: 1,
  voucher_vip: 1,
  voucher_200: 5,
  voucher_1000: 5,
  voucher_5000: 5,
};

/** How many of each voucher the guest picked on the Offers page. */
export type Basket = Partial<Record<MoneyVoucherKey, number>>;

/** WHAT PAY CHARGES (MESITA-4647): the picked vouchers in the page's order,
 *  each clamped to its cap, the zero ones and the ones not buyable dropped.
 *  Pure: it decides the basket a card is charged for. */
export function basketItems(basket: Basket, buyable: (k: MoneyVoucherKey) => boolean = () => true): VoucherBasketItem[] {
  return listedProducts().flatMap((p) => {
    const raw = basket[p.key] ?? 0;
    const n = Number.isFinite(raw) ? Math.min(Math.max(0, Math.floor(raw)), BASKET_MAX[p.key]) : 0;
    return n > 0 && buyable(p.key) ? [{ voucher: p.key, qty: n }] : [];
  });
}

/** One line of a basket as the receipt draws it, copied when Pay is tapped. */
type ReceiptLine = { key: MoneyVoucherKey; short: string; qty: number; pay: string };

/** How a basket's charge ended, built from the copy taken at Pay (never the
 *  live steppers or catalog, which may change while the bank answers). */
type Receipt = {
  outcome: "paid" | "processing";
  lines: ReceiptLine[];
  pay: string;
  bonus: string | null;
  get: string;
  readyAt: string | null;
  card: { label: string; last4: string } | null;
  at: string;
};

/** The basket's sums from the server's catalog lines, or null when a line
 *  is missing (then nothing can be added up, and Pay waits). */
function basketTotals(items: VoucherBasketItem[], catalog: Partial<Record<MoneyVoucherKey, VoucherCatalogLine>>) {
  let price = 0;
  let bonus = 0;
  let credit = 0;
  let wait = 0;
  for (const i of items) {
    const line = catalog[i.voucher as MoneyVoucherKey];
    if (!line) return null;
    price += line.price_cents * i.qty;
    bonus += line.bonus_cents * i.qty;
    credit += line.credit_cents * i.qty;
    wait = Math.max(wait, line.available_after_sec);
  }
  return { price, bonus, credit, wait };
}

/** The reads the Offers page pays with: the rules, the catalog and the cards. */
function useOfferCheckout(place: PlaceDetail, actions: PlaceActions | undefined) {
  const money = place.money;
  // The host is still asking list-vouchers and the place read carried no
  // offer: draw the rows, never a guess (MESITA-3388).
  const loading = actions?.vouchersLoading === true && !money;
  const rules = offerRules(money, actions?.guest);
  const catalog = money?.catalog ?? {};
  const currency = money?.currency ?? "mxn";
  const live = Boolean(actions?.onBuyVoucher);
  const buying = actions?.buyingVoucher != null;
  const payCards: PayCards | undefined = actions?.payCards;
  const readyCards = payCards?.state === "ready" ? payCards.cards : null;
  const payCardId = actions?.payCardId ?? null;
  const payCard = readyCards?.find((c) => c.id === payCardId && !isCardExpired(c)) ?? null;
  // Change steps to the next usable card (MESITA-4150).
  const usableCards = readyCards?.filter((c) => !isCardExpired(c)) ?? [];
  const nextCard = () => {
    if (usableCards.length < 2) return;
    const at = usableCards.findIndex((c) => c.id === payCard?.id);
    actions?.onSelectPayCard?.(usableCards[(at + 1) % usableCards.length].id);
  };
  // Signed out: no balance and no cards were read (MESITA-4224, D6).
  const signedOut = live && money != null && money.balance === null && payCards === undefined;
  return {
    loading,
    ...rules,
    catalog,
    currency,
    live,
    buying,
    payCards,
    readyCards,
    payCard,
    canChange: usableCards.length > 1,
    nextCard,
    signedOut,
    needsCard: !signedOut && payCards?.state === "ready" && payCard === null,
  };
}

/** A row of the receipt: a label at the left, the value at the right. */
function ReceiptRow({ label, value, green }: { label: string; value: ReactNode; green?: boolean }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-4 text-base">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right font-semibold tabular-nums", green ? "text-[#00A85A]" : "text-foreground")}>{value}</span>
    </div>
  );
}

/** − n + (MESITA-4647): one voucher's count in the basket. */
function Stepper({ name, n, max, disabled, onChange }: { name: string; n: number; max: number; disabled: boolean; onChange: (n: number) => void }) {
  const btn =
    "border-border text-foreground hover:bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-30";
  return (
    <div className="flex shrink-0 items-center gap-0.5" data-offer-stepper>
      <button type="button" aria-label={`Remove one ${name}`} disabled={disabled || n <= 0} onClick={() => onChange(n - 1)} className={btn} data-offer-minus>
        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
      {/* THE COUNT READS FIRST (Pato, 2026-11-22, MESITA-4672: "make the
          number of amount between - and + more visible"): 18px bold in a
          fixed circle so it never jumps; picked (> 0) is an ink circle with
          white digits, 0 stays plain and muted. */}
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base leading-none font-bold tabular-nums",
          n > 0 ? "bg-foreground text-paper" : "text-muted-foreground",
        )}
        aria-live="polite"
        data-offer-qty
      >
        {n}
      </span>
      <button type="button" aria-label={`Add one ${name}`} disabled={disabled || n >= max} onClick={() => onChange(n + 1)} className={btn} data-offer-plus>
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

/** THE OFFERS PAGE IS A SHOP (Pato, 2026-11-22, MESITA-4647: "the offers can
 *  be multiselected ... don't create a special subpage ... it must feel like
 *  a shopify page. the voucher ticket is not created/saved until the sale is
 *  done"). Each buyable row has − n +; one sticky Pay bar charges the whole
 *  basket once with the saved card; a receipt replaces the list after.
 *  Nothing is stored before the card charge answers: the basket lives in
 *  this component. Each voucher's own ticket page (MESITA-4630) went.
 *  `pick` preselects one voucher (an old link) when it is buyable. */
/** One size for every offer badge (Pato, 2026-11-22, MESITA-4702: "boxes
 *  same size"): cashback and vouchers alike. */
// SMALLER ON A NARROW PHONE (Pato, 2026-11-23, MESITA-4788: "info gets lost,
// make items smaller"): 64px, not 76px, so the name and its line keep room.
const BADGE = "flex min-h-11 w-16 shrink-0 flex-col items-center justify-center rounded-xl py-1.5 tabular-nums";

export type CashbackLineRow = { line: "welcome" | "welcome_vip" | "returning" | "returning_vip"; title: string; who: string; bps: number; mech: VisitMechanism };

/** The place's lines that earn (rate above Off): Welcome, Returning, then
 *  Returning VIP (MESITA-4766, Pato: "NOW THE PAY OFFERS ARE Welcome
 *  Everyone, Returning Regular, Returning VIP"). A guest never reads the
 *  word Regular: the middle line is plain Returning. Two lines under
 *  MESITA-4709 ("no more VIP"). MESITA-4770: each carries the place's
 *  mechanism (Discount or Cashback). */
export function cashbackRows(cashback: PlaceCashback): CashbackLineRow[] {
  const mech = visitMechanismOf({ cashback });
  return (
    [
      // FOUR TIERS IN PATO'S ORDER (2026-11-23, MESITA-4789), in the guest's
      // words (MESITA-4806); Business keeps Welcome Regular … Returning VIP.
      { line: "welcome", title: "Welcome Visit", who: "Your first bill here", bps: cashback.welcome_bps, mech },
      { line: "returning", title: "Returning Visit", who: "Every bill after your first", bps: cashback.returning_bps, mech },
      { line: "welcome_vip", title: "VIP Welcome Visit", who: "Your first bill here", bps: cashback.welcome_vip_bps ?? cashback.welcome_bps, mech },
      { line: "returning_vip", title: "VIP Returning Visit", who: "Every bill after your first", bps: cashback.returning_vip_bps ?? 0, mech },
    ] as CashbackLineRow[]
  ).filter((r) => r.bps > 0);
}

/** Why this guest cannot get a tier here (Pato, 2026-11-23, MESITA-4791:
 *  "if offer blocked, block the offer"), from the server's `line` for their
 *  next bill: a VIP tier for a Regular, a Regular tier for a VIP, a Welcome
 *  tier once their first bill here is paid. Null = theirs to get, or signed
 *  out (no line). The row stays, dimmed with a lock; a tier the place
 *  turned Off is not a row at all (cashbackRows). Pure. */
export function lockedWhy(row: CashbackLineRow["line"], guest: PlaceCashback["line"] | null | undefined): string | null {
  if (!guest) return null;
  const guestVip = guest === "welcome_vip" || guest === "returning_vip";
  const rowVip = row === "welcome_vip" || row === "returning_vip";
  if (rowVip && !guestVip) return "VIP guests only";
  if (!rowVip && guestVip) return "Regular guests only";
  const guestFirst = guest === "welcome" || guest === "welcome_vip";
  if ((row === "welcome" || row === "welcome_vip") && !guestFirst) return "Already used";
  return null;
}

/** The row marked "You": the server's `line` for this guest's next bill,
 *  never worked out from the guest's Class (MESITA-4766). None signed out
 *  (`line` null) or when that line pays nothing here. */
export function youLine(cashback: PlaceCashback | null | undefined): CashbackLineRow["line"] | null {
  if (!cashback?.line) return null;
  return cashbackRows(cashback).some((r) => r.line === cashback.line) ? cashback.line : null;
}

/** MESITA-4698/4702: the place's cashback on the one Offers page. Two
 *  lines (Welcome on a first bill, then Returning; MESITA-4709), the
 *  guest's own marked Yours. Nothing to buy: a
 *  confirmed bill earns it, 1 hour later (MESITA-4717), with no minimum. */
function CashbackPanel({
  cashback,
  onBecomeVip,
}: {
  cashback: PlaceCashback;
  onBecomeVip?: () => void;
}) {
  const rows = cashbackRows(cashback);
  const you = youLine(cashback);
  if (rows.length === 0) return null;
  return (
    <section className={cn(CARD, "shrink-0 overflow-hidden")} aria-label="Visit offers" data-promos="cashback">
      <ul className="divide-border divide-y" data-cashback-lines>
        {rows.map((r) => {
          const mine = you === r.line;
          const why = lockedWhy(r.line, cashback?.line);
          return (
            <li key={r.line} data-cashback={r.line} data-cashback-locked={why ? "" : undefined} className="flex min-h-16 flex-wrap items-center gap-2.5 px-3 py-2">
              <span className={cn(BADGE, why ? "bg-muted text-muted-foreground" : visitTone(r.mech))} aria-hidden>
                <span className="text-base leading-none font-bold tracking-tight">{r.bps / 100}%</span>
                <span className="mt-1 type-meta leading-none font-bold tracking-wide uppercase">{visitWord(r.mech)}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-1">
                  <span className={cn("truncate text-base font-semibold", why ? "text-muted-foreground" : "text-foreground")}>{r.title}</span>
                </span>
                {/* ONE SHORT LINE (Pato, 2026-11-23, MESITA-4812: "write the
                    descriptions clearer and cleaner"): which bill it is for, or
                    why it is locked. The name says VIP; when it lands is in How
                    it works. */}
                {why ? (
                  // LOCKED, LIKE PREPAY'S VIP VOUCHER (MESITA-4791): a lock and the reason.
                  <span className="text-foreground mt-0.5 flex min-w-0 items-center gap-1 text-sm font-semibold" data-cashback-why>
                    <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                    <span className="truncate">{why}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">{r.who}</span>
                )}
              </span>
              {mine ? (
                <span className="bg-foreground text-background shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" data-cashback-mine>
                  You
                </span>
              ) : null}
              {/* HOW TO BECOME VIP (MESITA-4766): a quiet link under the VIP
                  line, only where the host knows the guest is not VIP. */}
              {r.line === "returning_vip" && onBecomeVip ? (
                <button
                  type="button"
                  onClick={onBecomeVip}
                  className="text-muted-foreground hover:text-foreground -mt-1 flex min-h-11 basis-full items-center pl-[4.625rem] text-left text-sm font-semibold underline underline-offset-2"
                  data-cashback-become-vip
                >
                  How to become VIP
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {/* NO FOOTNOTE (Pato, MESITA-4702: "remove the explanations there,
          that's why we have the i"): the rules live in How it works. */}
    </section>
  );
}

/** HOW IT WORKS BEHIND AN (i) (Pato, 2026-11-23, MESITA-4725: "don't
 *  overexplain there. just the boxes. then below or something an i icon to
 *  see explanation, but don't show that always"): one quiet 44px text button
 *  under a tab's boxes; a tap opens a centred window.
 *  THE ONLY (i) (Pato, 2026-11-23, MESITA-4804: "only one i in how it works.
 *  there display all the info, don't lose info"): the rows' own (i) went;
 *  their deals and rules are in here. */
function HowItWorks({ title, lead, tab, children }: { title: string; lead: string; tab: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const host = typeof document === "undefined" ? null : document.getElementById("mesita-app-card");
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="text-muted-foreground hover:text-foreground flex min-h-11 shrink-0 items-center gap-1.5 self-center px-1 text-sm font-semibold"
        data-how-it-works={tab}
      >
        {/* CENTRED (Pato, 2026-11-23, MESITA-4779: "how it works button maybe be centered"). */}
        <Info className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
        How it works
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className={cn(host ? "absolute" : "fixed", "inset-0 z-[135] flex items-center justify-center bg-black/40 p-4")} onClick={() => setOpen(false)} data-how-it-works-dialog={tab}>
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={`how-${tab}-title`}
                className="bg-card flex max-h-full w-full max-w-md cursor-auto flex-col overflow-hidden rounded-2xl shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-card border-border flex h-14 shrink-0 items-center justify-between border-b pr-1.5 pl-4">
                  <h2 id={`how-${tab}-title`} className="text-foreground text-base font-semibold">
                    {title}
                  </h2>
                  <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="text-foreground hover:bg-muted flex h-11 w-11 items-center justify-center rounded-full transition">
                    <X className="h-6 w-6" strokeWidth={2.25} />
                  </button>
                </div>
                <div className="scrollbar-thin-dark flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
                  <p className="text-foreground text-base leading-snug" data-how-lead>
                    {lead}
                  </p>
                  {children}
                </div>
              </div>
            </div>,
            host ?? document.body,
          )
        : null}
    </>
  );
}

/** The four tiers as one table (MESITA-4807): which visit across, which
 *  guest down; the guest's own cell in ink, a tier that gives nothing a dash. */
function TierTable({ rows, guest }: { rows: CashbackLineRow[]; guest: PlaceCashback["line"] }) {
  const cell = (line: CashbackLineRow["line"]) => {
    const row = rows.find((o) => o.line === line);
    const mine = guest === line && row != null;
    return (
      <td className="py-1 pl-2">
        <span
          className={cn(
            "flex min-h-11 flex-col items-center justify-center rounded-xl text-base leading-tight font-semibold tabular-nums",
            mine ? "bg-foreground text-background" : row ? "bg-muted text-foreground" : "bg-muted text-muted-foreground",
          )}
          data-how-tier={line}
        >
          {row ? `${row.bps / 100}%` : "—"}
          {mine ? <span className="text-xs">You</span> : null}
        </span>
      </td>
    );
  };
  return (
    <Box title={`${visitWord(rows[0].mech)} you get`} data-how-offers="">
      <table className="w-full table-fixed">
        <thead>
          <tr className="text-foreground text-sm font-semibold">
            <td />
            <th scope="col" className="pb-1 pl-2 font-semibold">
              Welcome Visit
              <span className="text-muted-foreground block text-xs font-normal">Your first bill here</span>
            </th>
            <th scope="col" className="pb-1 pl-2 font-semibold">
              Returning Visit
              <span className="text-muted-foreground block text-xs font-normal">Every bill after</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="text-foreground text-left text-sm font-semibold">Regular guests</th>
            {cell("welcome")}
            {cell("returning")}
          </tr>
          <tr>
            <th scope="row" className="text-foreground text-left text-sm font-semibold">VIP guests</th>
            {cell("welcome_vip")}
            {cell("returning_vip")}
          </tr>
        </tbody>
      </table>
    </Box>
  );
}

/** The steps in full sentences (Pato, 2026-11-24, MESITA-4828: "write the how
 *  it works clearer, even if more text"): a number, a bold line, what happens. */
function NumberedSteps({ steps }: { steps: { title: string; text: string }[] }) {
  return (
    <Box title="Step by step">
      <ol className="flex flex-col gap-3" data-how-steps>
        {steps.map((x, i) => (
          <li key={x.title} className="flex items-start gap-3">
            <span className="bg-foreground text-background flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums" aria-hidden>
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-foreground block text-base leading-7 font-semibold">{x.title}</span>
              <span className="text-muted-foreground block text-sm leading-snug">{x.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </Box>
  );
}

/** The bill the worked example uses, in whole pesos. */
const EXAMPLE_BILL = 500;

/** Pay's How it works (Pato, 2026-11-23, MESITA-4807: "this explanation
 *  clearer"): one sentence, the steps as a worked example at the guest's own
 *  rate (else the first tier's), one table of rates, the rules in full. */
function PayHowItWorks({ rows, guest }: { rows: CashbackLineRow[]; guest: PlaceCashback["line"] }) {
  // MESITA-4770: a Discount comes off the printed bill before paying; the
  // waiter sees it on the bill. Cashback lands as credit an hour later.
  const shown = rows.find((o) => o.line === guest) ?? rows[0];
  const discount = shown.mech === "discount";
  const rate = `${shown.bps / 100}%`;
  const gives = (EXAMPLE_BILL * shown.bps) / 10000;
  const steps: Step[] = discount
    ? [
        { Icon: QrCode, title: "Your bill", amount: `$${EXAMPLE_BILL}`, line: "Your waiter sends it" },
        { Icon: Wallet, title: "Discount", amount: `−$${gives}`, line: `${rate} off`, green: true },
        { Icon: Utensils, title: "You pay", amount: `$${EXAMPLE_BILL - gives}`, line: "Plus your tip" },
      ]
    : [
        { Icon: QrCode, title: "You pay", amount: `$${EXAMPLE_BILL}`, line: "At this place" },
        { Icon: Clock, title: "Wait", amount: "1 hour", line: "Nothing to do" },
        { Icon: Wallet, title: "You get", amount: `$${gives}`, line: `${rate} back as credit`, green: true },
      ];
  // ONLY PATO'S FACTS (MESITA-4728: no cap, no once-a-day).
  const facts: Fact[] = discount
    ? [
        { Icon: Utensils, text: "The discount is on the bill, never on the tip." },
        { Icon: Wallet, text: "If you have credits here, they are used first. Credits never pay the tip." },
      ]
    : [
        { Icon: Utensils, text: "Use your cashback to pay any bill at this place." },
        { Icon: InfinityIcon, text: "It never expires." },
        { Icon: Wallet, text: "The part of a bill you pay with credit earns no cashback, and neither does the tip. One bill earns $1,000 of cashback at most." },
      ];
  return (
    <HowItWorks
      tab="pay"
      title={discount ? "How your discount works" : "How cashback works"}
      lead={
        discount
          ? "When you pay your bill here with Mesita, the discount comes off before you pay."
          : "Pay your bill with Mesita and part of it comes back to you as credit for your next visit here."
      }
    >
      <NumberedSteps
        steps={[
          { title: "Show your QR", text: "When you want the bill, open Pay Bill and show your QR to your waiter." },
          {
            title: "Check the bill",
            text: `Your waiter types the bill and the tip. You see them on your phone${discount ? ", with the discount already taken off," : ""} and tap Accept.`,
          },
          { title: "Pay at the place", text: "Pay your waiter in cash or on the place's card terminal. Mesita doesn't charge your card." },
          discount
            ? { title: "Done", text: "Your waiter confirms the payment and you get your receipt." }
            : { title: "Get your cashback", text: "Your waiter confirms the payment. One hour later the cashback is in your Wallet, as credit for this place." },
        ]}
      />
      <Box title={`Example: a $${EXAMPLE_BILL} bill`}>
        <StepList steps={steps} />
      </Box>
      <TierTable rows={rows} guest={guest} />
      <GoodToKnow facts={facts} />
    </HowItWorks>
  );
}

/** Prepay's How it works: the steps, every voucher's deal and rule, the rules. */
function PrepayHowItWorks({ products, co }: { products: Product[]; co: Checkout }) {
  const { loading, catalog, currency } = co;
  const rule = (k: MoneyVoucherKey) =>
    k === "voucher_welcome" ? "Once per guest at this place." : k === "voucher_vip" ? "One per visit." : null;
  const facts: Fact[] = [
    { Icon: Utensils, text: "Your credit pays any bill at this place. It can't be used at other places, and it never pays the tip." },
    { Icon: Gift, text: "You can send your credit to a friend as a gift." },
    { Icon: InfinityIcon, text: "Your credit never expires." },
    ...(products.some((p) => rule(p.key) === null) ? [{ Icon: Repeat, text: "You can buy as many as you like." }] : []),
  ];
  return (
    <HowItWorks tab="prepay" title="How prepaying works" lead="You buy a voucher today and get more credit than you paid, to spend at this place on your next visits.">
      <NumberedSteps
        steps={[
          { title: "Pick a voucher and pay", text: "Choose one or more with the + button and pay with your card." },
          { title: "Wait 3 hours", text: "What you paid and your bonus arrive together, as credit in your Wallet. You don't have to do anything." },
          { title: "Spend it here", text: "When you want the bill, open Pay Bill and show your QR to your waiter. Your credit is used first and you pay only what is left." },
        ]}
      />
      {loading ? null : (
        <OfferFacts
          rows={products.map((p) => {
            const line = catalog[p.key];
            return {
              key: p.key,
              title: p.short,
              line: `You pay ${whole(priceValue(p, line, currency))}, you get ${whole(creditValue(p, line, currency))}`,
              rule: rule(p.key),
              rate: `${bonusValue(p, line)} Bonus`,
            };
          })}
        />
      )}
      <GoodToKnow facts={facts} />
    </HowItWorks>
  );
}

/** TWO SUBPAGES, PREPAY · PAY (MESITA-4710; Post went with Stories,
 *  MESITA-4766): Prepay sells the vouchers, Pay is paying the bill here and
 *  the cashback it earns. What a guest earned stays on the Loyalty Card and
 *  Tickets. */
export type OffersTab = "prepay" | "pay";

// THE TABS' ICONS (Pato, 2026-11-23, MESITA-4726): Prepay a wallet (credit
// loaded ahead), Pay a receipt (the bill).
const OFFERS_TABS: { id: OffersTab; word: string; Icon: ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { id: "prepay", word: "Prepay", Icon: BadgePlus },
  { id: "pay", word: "Pay", Icon: ReceiptIcon },
];

/** The tab bar (MESITA-4710), MESITA-4701's last approved bar: three equal
 *  thirds, an icon over the word, the open tab in ink with a 3px ink line
 *  under it, no product colour. It scrolls with the page; only the bottom
 *  bar is sticky. While a charge is out (`locked`) no tab switches. Arrow
 *  keys move between tabs (roving tabIndex). */
function OffersTabs({
  tab,
  onTab,
  locked,
  picked,
  barRef,
}: {
  tab: OffersTab;
  onTab: (t: OffersTab) => void;
  locked: boolean;
  picked: number;
  barRef: RefObject<HTMLDivElement | null>;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (from: number, step: number) => {
    if (locked) return;
    const to = (from + step + OFFERS_TABS.length) % OFFERS_TABS.length;
    onTab(OFFERS_TABS[to].id);
    refs.current[to]?.focus();
  };
  return (
    <div
      ref={barRef}
      // A SEGMENTED CONTROL (Pato, 2026-11-23, MESITA-4737: "not line ...
      // maybe slightly gray background or something NOT in the items"): one
      // light grey track across the page, the chosen tab a white raised pill;
      // no underline, no hairline. Full width since MESITA-4727.
      className="bg-card shrink-0 px-4 pb-3"
      role="tablist"
      aria-label="Offers"
      data-offers-tabs
    >
      <div className="bg-muted flex gap-1 rounded-2xl p-1">
      {OFFERS_TABS.map(({ id, word, Icon }, i) => {
        const on = tab === id;
        // "Prepay · N" while the basket holds anything (MESITA-4710).
        const count = id === "prepay" && picked > 0 ? picked : 0;
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`offers-tab-${id}`}
            aria-selected={on}
            aria-controls={`offers-panel-${id}`}
            aria-disabled={locked || undefined}
            aria-label={count ? `${word}, ${count} picked` : undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => onTab(id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                move(i, e.key === "ArrowRight" ? 1 : -1);
              }
            }}
            className={cn(
              "flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl text-base font-semibold transition",
              on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              !on && !locked && "hover:text-foreground",
              locked && "cursor-not-allowed",
            )}
            data-offers-tab={id}
          >
            <span className="flex" aria-hidden>
              <Icon className="h-5 w-5" strokeWidth={on ? 2.5 : 2} />
            </span>
            <span className="truncate tabular-nums">{count ? `${word} · ${count}` : word}</span>
          </button>
        );
      })}
      </div>
    </div>
  );
}

/** Two grey bone rows while a read is out. */
function BoneRows({ n }: { n: number }) {
  return (
    <div className={cn(CARD, "divide-border shrink-0 divide-y overflow-hidden")} aria-busy data-offers-bones>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex min-h-16 items-center gap-2.5 px-3 py-2" aria-hidden>
          <span className="bg-muted h-11 w-16 shrink-0 animate-pulse rounded-xl" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="bg-muted h-4 w-32 animate-pulse rounded" />
            <span className="bg-muted h-3 w-44 animate-pulse rounded" />
          </span>
        </div>
      ))}
    </div>
  );
}

type Checkout = ReturnType<typeof useOfferCheckout>;

/** PREPAY (MESITA-4710): the vouchers, their steppers and the voucher Pay
 *  bar. A section of its own, so a page that stacks the sections again can
 *  reuse it; the basket stays in VouchersPane. */
function PrepaySection({
  products,
  co,
  basket,
  locked,
  count,
  totals,
  failed,
  actions,
  onQty,
  onPay,
}: {
  products: Product[];
  co: Checkout;
  basket: Basket;
  locked: boolean;
  count: number;
  totals: ReturnType<typeof basketTotals>;
  /** No offer was read at all (list-vouchers failed, or none came): the
   *  empty line offers Retry. */
  failed: boolean;
  actions: PlaceActions | undefined;
  onQty: (k: MoneyVoucherKey, n: number) => void;
  onPay: () => void;
}) {
  const { loading, dim, guestLock, buyable, unavailable, catalog, currency } = co;
  if (!loading && products.length === 0) {
    // EVERY TAB HAS AN EMPTY STATE (MESITA-4710): no row to show, no bar.
    return (
      <p className={cn(CARD, "text-muted-foreground flex shrink-0 flex-col items-center gap-2 px-4 py-6 text-center text-sm")} data-offers-none="prepay">
        This place sells no prepay offers yet.
        {failed && actions?.onLoadVouchers ? (
          <button type="button" onClick={actions.onLoadVouchers} className="text-foreground min-h-9 font-semibold underline underline-offset-2">
            Retry
          </button>
        ) : null}
      </p>
    );
  }
  return (
    <>
      {GROUPS.map((g) => {
        const list = products.filter((p) => g.keys.has(p.key));
        if (list.length === 0) return null;
        return (
          <section key={g.id} className={cn(CARD, "shrink-0 overflow-hidden")} aria-label={g.title} data-promos={g.id}>
            <ul className="divide-border divide-y" data-voucher-catalog>
              {list.map((p) => {
                const line = catalog[p.key];
                const pay = priceValue(p, line, currency);
                const get = creditValue(p, line, currency);
                const can = !loading && buyable(p.key);
                const bonus = bonusValue(p, line);
                const blocked = !loading && !can;
                const why = blocked ? offerStatus(p.key, false, guestLock(p.key), unavailable[p.key], actions?.guest).text : "";
                const n = basket[p.key] ?? 0;
                // ASK TO LINK (MESITA-4659): a VIP row locked because the
                // guest has no verified Instagram offers "Link Instagram"
                // where the stepper goes, when the host can open Me › Instagram.
                const linkIg =
                  blocked && guestLock(p.key) === "vip" && actions?.guest != null && !actions.guest.instagramLinked
                    ? actions.onLinkInstagram
                    : undefined;
                // A PRODUCT ROW (Pato, 2026-11-22, MESITA-4647): left ONE
                // green box, black "+10%" over "BONUS"; the name and the deal
                // (no (i), MESITA-4804); − n + at the right. A blocked row says why,
                // with a lock, and has no stepper.
                return (
                  <li key={p.key} data-voucher={p.key} className={cn("flex min-h-16 items-center gap-2.5 px-3 py-2", blocked && dim && !linkIg && "opacity-50")}>
                    <span
                      className={cn(
                        BADGE,
                        // Each voucher's own colour: VIP yellow, the rest green
                        // (MESITA-4688); VIP keeps it while locked, the row dims.
                        blocked ? "bg-muted text-muted-foreground" : VOUCHER_TONE[p.key],
                      )}
                      aria-hidden
                      data-offer-bonus
                    >
                      <span className="text-base leading-none font-bold tracking-tight">{bonus}</span>
                      <span className="mt-1 type-meta leading-none font-bold tracking-wide uppercase">Bonus</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex min-w-0 items-center gap-1">
                        <span className={cn("truncate text-base font-semibold", blocked ? "text-muted-foreground" : "text-foreground")}>{p.short}</span>
                      </span>
                      <span className={cn("text-sm font-semibold tabular-nums", blocked ? "text-muted-foreground" : "text-foreground")}>
                        Pay {whole(pay)} <span className="text-muted-foreground">·</span> Get {whole(get)}
                      </span>
                      {blocked ? (
                        <span className="text-foreground mt-0.5 flex min-w-0 items-center gap-1 text-sm font-semibold" data-voucher-why>
                          <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} data-voucher-locked />
                          <span className="truncate">{why.replace(/\.$/, "")}</span>
                        </span>
                      ) : null}
                    </span>
                    {can && co.live ? (
                      <Stepper name={p.short} n={n} max={BASKET_MAX[p.key]} disabled={locked} onChange={(v) => onQty(p.key, v)} />
                    ) : linkIg ? (
                      <button
                        type="button"
                        onClick={linkIg}
                        className="bg-foreground text-background flex h-9 shrink-0 items-center rounded-full px-3 text-sm font-semibold"
                        data-offer-link-instagram
                      >
                        Link Instagram
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <PrepayHowItWorks products={products} co={co} />
      {/* THE PAY BAR (MESITA-4647), SHOWN ONCE A VOUCHER IS PICKED (MESITA-4763; always there under (Pato,
          2026-11-22, MESITA-4659; MESITA-4710, d2a): sticky at the bottom,
          the same lines whatever is picked — Pay, Bonus (green), then under a
          hairline the total, You get in 3 hours (MESITA-4717: all of it lands
          together; MESITA-4669, Pato: "a bit confusing, add a line"). Then one purple pill (MESITA-4840). Ready to charge with a saved
          card, it splits in half (MESITA-4669, Pato: "50% of button for the
          payment method, 50% right for the amount … pay x get y, even if a
          bit redundant"): the card on the left (a tap cycles cards, the old
          Change), Pay $X over Get $Y on the right. Every other state is the
          one full-width button: with nothing picked every line reads $0 and
          it says "Select an offer", disabled: an empty basket charges
          nothing. The purple Go to Pay Bill moved to Checkout (MESITA-4710). */}
      {(() => {
        // NO COUNT UNTIL SOMETHING IS PICKED (Pato, 2026-11-23, MESITA-4763),
        // BUT THE BUTTON STAYS, PURPLE SINCE MESITA-4840 (Pato, 2026-11-24, MESITA-4828: "keep the
        // black button at the bottom but say select an offer"): an empty
        // basket draws the button alone, where a voucher can be bought.
        if (count === 0) {
          if (loading || !co.live || !products.some((p) => buyable(p.key))) return null;
          return (
            <div className="bg-card border-border sticky bottom-0 z-10 -mx-4 mt-auto -mb-4 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" data-offer-pay-bar>
              <button type="button" disabled className="flex h-12 w-full items-center justify-center rounded-full bg-[#635BFF] text-base font-semibold text-white opacity-60" data-offer-select>
                Select an offer
              </button>
            </div>
          );
        }
        const sum = totals ?? { price: 0, bonus: 0 };
        const amount = (cents: number) => whole(pesos(cents, currency));
        const payDisabled = count === 0 || locked || totals === null || (co.payCards !== undefined && co.payCards.state !== "ready");
        const split = co.payCard !== null && !co.signedOut && count > 0 && totals !== null && !locked;
        return (
          <div className="bg-card border-border sticky bottom-0 z-10 -mx-4 mt-auto -mb-4 flex flex-col gap-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" data-offer-pay-bar>
            <dl className="flex flex-col gap-0.5 text-base" data-offer-summary>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-foreground font-semibold">Pay</dt>
                <dd className="text-foreground font-semibold tabular-nums" data-offer-sum-pay>{amount(sum.price)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Bonus</dt>
                <dd className="font-semibold text-[#00A85A] tabular-nums" data-offer-sum-bonus>+{amount(sum.bonus)}</dd>
              </div>
              <div className="border-border mt-1.5 flex items-center justify-between gap-3 border-t pt-1.5 text-lg">
                <dt className="text-foreground font-bold">You get in 3 hours</dt>
                <dd className="text-foreground font-bold tabular-nums" data-offer-sum-total>{amount(sum.price + sum.bonus)}</dd>
              </div>
            </dl>
            {co.payCards?.state === "error" ? (
              <p className="flex items-center justify-between text-sm" role="alert">
                <span className="text-foreground">Couldn&apos;t load your cards</span>
                <button type="button" onClick={actions?.onRetryPayCards} className="text-foreground min-h-9 shrink-0 font-semibold underline underline-offset-2">
                  Retry
                </button>
              </p>
            ) : null}
            {split && co.payCard && totals ? (
              <div className="flex h-14 w-full items-stretch overflow-hidden rounded-full bg-[#635BFF] text-white" data-offer-pay-split>
                <button
                  type="button"
                  disabled={!co.canChange}
                  onClick={co.nextCard}
                  className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 text-sm opacity-80 disabled:cursor-default"
                  aria-label={co.canChange ? `Paying with ${co.payCard.label} ending ${co.payCard.last4}. Change card` : `Paying with ${co.payCard.label} ending ${co.payCard.last4}`}
                  data-pay-card-line
                >
                  <CreditCard className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">
                    {co.payCard.label} •••• {co.payCard.last4}
                  </span>
                  {co.canChange ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden /> : null}
                </button>
                <span className="my-3 w-px shrink-0 bg-white/30" aria-hidden />
                <button
                  type="button"
                  disabled={payDisabled}
                  onClick={onPay}
                  className="flex min-w-0 flex-1 flex-col items-center justify-center px-3 leading-tight disabled:opacity-60"
                  data-offer-pay
                >
                  <span className="text-base font-semibold tabular-nums">Pay {amount(totals.price)}</span>
                  <span className="text-xs tabular-nums opacity-70">Get {amount(totals.price + totals.bonus)}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={payDisabled}
                onClick={onPay}
                className="flex h-12 w-full items-center justify-center rounded-full bg-[#635BFF] text-base font-semibold text-white hover:bg-[#5249e6] disabled:opacity-60"
                data-offer-pay
              >
                {locked ? "Paying…" : co.needsCard ? "Add a card" : totals ? `Pay ${amount(totals.price)}` : "Pay"}
              </button>
            )}
          </div>
        );
      })()}
    </>
  );
}

/** PAY (MESITA-4710; 1 hour since MESITA-4717): paying the bill here and the cashback it earns.
 *  The lines are the server's (Welcome, Returning, Returning VIP; MESITA-4766),
 *  then the purple Go to Pay Bill at the bottom (MESITA-4699). Nothing to
 *  buy: a confirmed bill earns it, 1 hour later, with no minimum. */
function CheckoutSection({
  cashback,
  loading,
  onPay,
  onBecomeVip,
}: {
  cashback: PlaceCashback | null;
  loading: boolean;
  onPay: (() => void) | undefined;
  onBecomeVip?: () => void;
}) {
  const rows = cashback ? cashbackRows(cashback) : [];
  return (
    <>
      {loading ? (
        <BoneRows n={2} />
      ) : cashback && rows.length > 0 ? (
        <CashbackPanel cashback={cashback} onBecomeVip={onBecomeVip} />
      ) : (
        // No cashback here, or the read failed: Pay Bill still works.
        <p className={cn(CARD, "text-muted-foreground shrink-0 px-4 py-6 text-center text-sm")} data-offers-none="pay">
          This place gives no Back yet. You can still pay your bill here.
        </p>
      )}
      {rows.length > 0 ? <PayHowItWorks rows={rows} guest={cashback?.line ?? null} /> : null}
      {/* PAY BILL UNDER CHECKOUT (Pato, 2026-11-22, MESITA-4699: "cashback
          just have shortcut to Go to Pay bill at the bottom, purple color"),
          sticky like Prepay's Pay bar. Absent onPay (admin's preview), no bar. */}
      {onPay ? (
        <div className="bg-card border-border sticky bottom-0 z-10 -mx-4 mt-auto -mb-4 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" data-cashback-pay-bar>
          <button
            type="button"
            onClick={onPay}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#00D66F] text-base font-semibold text-neutral-950 hover:bg-[#00c265]"
            data-cashback-pay-bill
          >
            <QrCode className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            Go to Pay Bill
          </button>
        </div>
      ) : null}
    </>
  );
}

export function VouchersPane({
  place,
  actions,
  pick,
  initialTab,
  onTabChange,
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
  pick?: string | null;
  /** The tab to open on (`?rewards=`), read once. An asked voucher (`pick`)
   *  opens Prepay whatever this says. Absent: Prepay. */
  initialTab?: OffersTab | null;
  /** Called after each switch the pane accepts (the host keeps the address). */
  onTabChange?: (tab: OffersTab) => void;
}) {
  const onLoad = actions?.onLoadVouchers;
  useEffect(() => {
    onLoad?.();
  }, [onLoad]);

  const co = useOfferCheckout(place, actions);
  const { loading, buyable, catalog, currency } = co;
  // ONE OWNER FOR LINKED STATE (MESITA-4710): the open tab lives here with
  // the basket and `locked`, so a switch never empties the basket and never
  // happens while a charge is out.
  const [tab, setTab] = useState<OffersTab>(() => (pick ? "prepay" : initialTab ?? "prepay"));
  const barRef = useRef<HTMLDivElement>(null);
  // The guest's own picks; until the first tap, an asked voucher counts as one.
  const [picked, setPicked] = useState<Basket | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const paying = useRef(false);
  const [payingNow, setPayingNow] = useState(false);
  const opened = useRef(new Set<MoneyVoucherKey>());
  const asked = !loading && pick && (MONEY_VOUCHER_KEYS as readonly string[]).includes(pick) && buyable(pick as MoneyVoucherKey) ? (pick as MoneyVoucherKey) : null;
  const basket: Basket = picked ?? (asked ? { [asked]: 1 } : {});
  const items = basketItems(basket, (k) => !loading && buyable(k));
  const count = items.reduce((n, i) => n + i.qty, 0);
  const totals = basketTotals(items, catalog);
  // Locked while a charge is out (MESITA-4647): the basket a card answers for
  // is the basket on screen.
  const locked = co.buying || payingNow;

  const switchTab = (t: OffersTab) => {
    // Refused while a charge is out, here and not only by styling (MESITA-4710).
    if (locked || paying.current || t === tab) return;
    setTab(t);
    onTabChange?.(t);
    // The new tab starts at the bar when the bar has scrolled away above.
    const bar = barRef.current;
    if (bar && typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        let scroller: HTMLElement | null = bar.parentElement;
        while (scroller && !/(auto|scroll)/.test(window.getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
        const top = scroller ? scroller.getBoundingClientRect().top : 0;
        if (bar.getBoundingClientRect().top < top) bar.scrollIntoView?.({ block: "start" });
      });
    }
  };

  const setQty = (k: MoneyVoucherKey, n: number) => {
    if (locked) return;
    // OFFER EVENTS BASELINE (MESITA-4375): offer_sheet_opened is now the
    // first + of each voucher, with whether a saved card is ready.
    if (n > 0 && !opened.current.has(k)) {
      opened.current.add(k);
      actions?.onOfferOpened?.(k, co.payCard !== null);
    }
    setPicked({ ...basket, [k]: Math.min(Math.max(0, n), BASKET_MAX[k]) });
  };

  const pay = async () => {
    if (!co.live || items.length === 0 || totals === null || locked || paying.current) return;
    // No card yet: Add a card, a modal; the basket stays, the guest taps Pay again.
    if (co.needsCard && actions?.onAddPayCard) {
      actions.onAddPayCard();
      return;
    }
    // THE COPY AT PAY (MESITA-4647): the receipt is built from what was sent.
    const sent = items.map((i) => ({ ...i }));
    const sentTotals = totals;
    const card = co.payCard;
    const lines: ReceiptLine[] = sent.map((i) => {
      const p = listedProducts().find((x) => x.key === i.voucher)!;
      const line = catalog[p.key]!;
      return { key: p.key, short: p.short, qty: i.qty, pay: pesos(line.price_cents * i.qty, currency) };
    });
    paying.current = true;
    setPayingNow(true);
    try {
      const out = await actions?.onBuyVoucher?.(sent, co.signedOut ? null : card?.id ?? null);
      if (out !== "paid" && out !== "processing") return;
      setReceipt({
        outcome: out,
        lines,
        pay: pesos(sentTotals.price, currency),
        bonus: sentTotals.bonus > 0 ? pesos(sentTotals.bonus, currency) : null,
        get: pesos(sentTotals.credit, currency),
        readyAt: new Date(Date.now() + sentTotals.wait * 1000).toISOString(),
        card,
        at: new Date().toISOString(),
      });
      setPicked({});
    } finally {
      paying.current = false;
      setPayingNow(false);
    }
  };

  // The receipt replaces the page body and the tabs (MESITA-4710); its Done
  // keeps the host's return rules.
  if (receipt) return <BasketReceipt receipt={receipt} onDone={() => (actions?.onOffersDone ? actions.onOffersDone() : setReceipt(null))} />;

  // HIDDEN ROWS ARE GONE (MESITA-4603), never drawn while list-vouchers is
  // still loading (every row is a grey bone then).
  const products = listedProducts().filter((p) => loading || co.show(p.key) !== "hidden");
  const cashback = place.money?.cashback ?? null;

  return (
    // THE MENU EDGE TO EDGE, THEN ONE TAB'S BOXES ON WHITE (MESITA-4727),
    // its bar at the bottom (MESITA-4710).
    <div className="-mx-4 -mt-4 flex flex-1 shrink-0 flex-col pb-4" data-promos-page>
      <OffersTabs tab={tab} onTab={switchTab} locked={locked} picked={count} barRef={barRef} />
      <div
        role="tabpanel"
        id={`offers-panel-${tab}`}
        aria-labelledby={`offers-tab-${tab}`}
        // ONE GAP (Pato, 2026-11-23, MESITA-4787: "keep same margins"): the
        // switch's own pb-3 is the 12px to the list, as the balance's mb-3 is
        // to the switch and gap-3 is between the boxes; no pt-4 on top.
        className="flex flex-1 shrink-0 flex-col gap-3 px-4"
        data-offers-panel={tab}
      >
        {tab === "prepay" ? (
          <PrepaySection
            products={products}
            co={co}
            basket={basket}
            locked={locked}
            count={count}
            totals={totals}
            failed={!place.money}
            actions={actions}
            onQty={setQty}
            onPay={() => void pay()}
          />
        ) : (
          <CheckoutSection
            cashback={cashback}
            loading={loading}
            onPay={actions?.onPay}
            onBecomeVip={actions?.guest?.guestClass === "vip" ? undefined : actions?.onBecomeVip}
          />
        )}
      </div>
    </div>
  );
}

/** THE BASKET'S RECEIPT (MESITA-4647): each line, what was paid, the card,
 *  the credit now, the bonus and when, then Done. */
function BasketReceipt({ receipt, onDone }: { receipt: Receipt; onDone: () => void }) {
  const bonusAt = receipt.readyAt ? readyClock(receipt.readyAt) : "";
  const at = new Date(receipt.at);
  const when = Number.isNaN(at.getTime())
    ? ""
    : at.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const paid = receipt.outcome === "paid";
  return (
    <div className="-mx-4 -mt-4 flex flex-1 shrink-0 flex-col gap-3 px-4 pt-4 pb-4" data-offer-receipt={receipt.outcome}>
      <section className={cn(CARD, "shrink-0 overflow-hidden")}>
        <div className="flex flex-col items-center gap-2 px-4 pt-5 pb-4 text-center">
          <CircleCheck className={cn("h-10 w-10", paid ? "text-[#00A85A]" : "text-muted-foreground")} strokeWidth={2.25} aria-hidden />
          <h3 className={OFFERS_TITLE_CLASS}>{paid ? "Paid" : "Confirming your payment"}</h3>
          <p className="text-muted-foreground text-sm">
            {paid ? "Everything lands together in 3 hours, by itself." : "Your bank is confirming it. Your credit shows once it does."}
          </p>
        </div>
        <div className="border-border divide-border divide-y border-t">
          {receipt.lines.map((l) => (
            <ReceiptRow key={l.key} label={`${l.qty} × ${l.short}`} value={whole(l.pay)} />
          ))}
          <ReceiptRow label="You paid" value={whole(receipt.pay)} />
          <ReceiptRow label="Card" value={receipt.card ? `${receipt.card.label} •••• ${receipt.card.last4}` : "Card"} />
          {when ? <ReceiptRow label="Date" value={when} /> : null}
          {receipt.bonus ? <ReceiptRow label="Bonus" value={`+${whole(receipt.bonus)}`} green /> : null}
          <ReceiptRow label={bonusAt ? `You get at ${bonusAt}` : "You get in 3 hours"} value={whole(receipt.get)} green />
        </div>
      </section>
      <button type="button" onClick={onDone} className="bg-foreground text-paper mt-auto flex h-12 w-full shrink-0 items-center justify-center rounded-full text-base font-semibold" data-offer-done>
        Done
      </button>
    </div>
  );
}
