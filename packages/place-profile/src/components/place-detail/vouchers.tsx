"use client";

import { type ComponentType, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Wallet, Clock, ArrowRight, Banknote, Percent, Receipt as ReceiptIcon, ChevronDown, CircleCheck, CreditCard, Crown, Info, Lock, Minus, PartyPopper, Plus, QrCode, Ticket, X, type LucideIcon } from "lucide-react";
import { isCardExpired, type PayCards } from "../../pay-cards";

import type { PlaceActions, VoucherBasketItem } from "../../actions";
import { cn } from "../../lib/cn";
import { CASHBACK_TONE, VOUCHER_TONE } from "../../lib/offers";
import { MONEY_VOUCHER_KEYS, moneyState, type MoneyVoucherKey, NOT_YET_SELLABLE, type VoucherReason } from "../../money-state";
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
  // SMALL · MEDIUM · BIG BONUS FOR THE GUEST (Pato, 2026-11-24, MESITA-4875:
  // "voucher is confusing"); Business keeps Voucher.
  { key: "voucher_200", name: "Small Bonus", line: "Pay $200.00MX, get $220.00MX.", limit: "As many as you like.", bonus: "10% bonus", short: "Small Bonus", brief: "As many as you like" },
  { key: "voucher_1000", name: "Medium Bonus", line: "Pay $1,000.00MX, get $1,200.00MX.", limit: "As many as you like.", bonus: "20% bonus", short: "Medium Bonus", brief: "As many as you like" },
  // MESITA-4980: the default Big bonus is 30% (40% from MESITA-4764). The
  // place can still pick 60%. This copy is the default.
  { key: "voucher_5000", name: "Big Bonus", line: "Pay $5,000.00MX, get $6,500.00MX.", limit: "As many as you like.", bonus: "30% bonus", short: "Big Bonus", brief: "As many as you like" },
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
): InfoStatus {
  // VIP ONLY (MESITA-4640): who it is for.
  if (lock === "vip") {
    // An invitation code is the only way in (MESITA-4849).
    return { ok: false, text: "For VIP guests, by invitation code." };
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
    const status = offerStatus(p.key, can, guestLock(p.key), unavailable[p.key]);
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
    // Solid black (Pato, 2026-11-24, MESITA-4923: "make the - and + buttons black").
    "bg-foreground text-paper flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:opacity-85 disabled:opacity-25";
  return (
    <div className="flex shrink-0 items-center gap-0.5" data-offer-stepper>
      <button type="button" aria-label={`Remove one ${name}`} disabled={disabled || n <= 0} onClick={() => onChange(n - 1)} className={btn} data-offer-minus>
        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
      {/* THE COUNT READS FIRST (Pato, 2026-11-22, MESITA-4672: "make the
          number of amount between - and + more visible"): 18px bold in a
          fixed circle so it never jumps; picked (> 0) is black ink, 0 muted.
          No circle since the buttons are black ones (MESITA-4923). */}
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base leading-none font-bold tabular-nums",
          n > 0 ? "text-foreground" : "text-muted-foreground",
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
// SQUARE (Pato, 2026-11-24, MESITA-4875: "must be squares").
const BADGE = "flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl tabular-nums";

/** THE PAY CARD (Pato, 2026-11-27, MESITA-5071): one card, only the rate
 *  that applies to this guest, never the place's whole table. The server's
 *  `line` says whether the next bill is their first here; VIP changes
 *  nothing on Pay (VIP lives on Post only). Signed out reads as a first
 *  visit. A first-visit rate of Off falls through to Returning. Null when
 *  nothing applies: the tab shows its empty state. Pure. */
export function payCard(cashback: PlaceCashback | null | undefined): { bps: number; first: boolean; thenBps: number } | null {
  if (!cashback) return null;
  const first = cashback.line == null || cashback.line === "welcome" || cashback.line === "welcome_vip";
  if (first && cashback.welcome_bps > 0) return { bps: cashback.welcome_bps, first: true, thenBps: cashback.returning_bps };
  if (cashback.returning_bps > 0) return { bps: cashback.returning_bps, first: false, thenBps: 0 };
  return null;
}

/** "20% back · On your first bill here", then "Then 5% back on every bill."
 *  Guests never read the word cashback (MESITA-5071): it is "X% back". */
function PayCardView({ card }: { card: { bps: number; first: boolean; thenBps: number } }) {
  return (
    <section className={cn(CARD, "flex shrink-0 items-center gap-3 p-3")} aria-label="Pay offer" data-promos="cashback" data-pay-card={card.first ? "first" : "every"}>
      <span className={cn(BADGE, CASHBACK_TONE, "text-xl font-bold")}>{card.bps / 100}%</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={OFFERS_TITLE_CLASS}>{card.bps / 100}% back</span>
        <span className="text-foreground text-sm">{card.first ? "On your first bill here" : "On every bill here, in credits"}</span>
        {card.first && card.thenBps > 0 ? (
          <span className="text-muted-foreground text-sm">Then {card.thenBps / 100}% back on every bill.</span>
        ) : null}
      </span>
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
function HowItWorks({ title, lead, tab, menu, children }: { title: string; lead: string; tab: string; menu?: ReactNode; children: ReactNode }) {
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
                {menu}
                <div key={title} className="scrollbar-thin-dark flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
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

// ── THE EXPLANATIONS (Pato, 2026-11-24, MESITA-4881: "clearer … with
// illustrations too, beautiful clean design for all the explanations") ──
// One design for Prepay and Cashback: one sentence, three scenes
// (a drawing with real numbers, a bold line, what happens), one closing line.
// No boxes inside boxes. The drawings are the app's own things: the QR, the
// bill, the credit card.

/** The bill the worked example uses, in whole pesos. */
const EXAMPLE_BILL = 500;

const SCENE_TINT = { prepay: "bg-indigo-50", cashback: "bg-green-50" } as const;

function Scene({ n, tint, art, title, text }: { n: number; tint: keyof typeof SCENE_TINT; art: ReactNode; title: string; text: string }) {
  return (
    <li className="flex flex-col" data-how-scene={n}>
      <div className={cn("flex h-36 items-center justify-center gap-3 overflow-hidden rounded-2xl px-3", SCENE_TINT[tint])} aria-hidden>
        {art}
      </div>
      <h4 className="text-foreground mt-3 flex items-center gap-2 text-lg leading-tight font-semibold">
        <span className="bg-foreground text-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">{n}</span>
        {title}
      </h4>
      <p className="text-muted-foreground mt-1 text-base leading-snug">{text}</p>
    </li>
  );
}

function Scenes({ children, note }: { children: ReactNode; note: string }) {
  return (
    <>
      <ol className="mt-1 flex flex-col gap-6" data-how-steps>
        {children}
      </ol>
      <p className="text-muted-foreground border-border mt-3 border-t pt-4 text-sm leading-relaxed">{note}</p>
    </>
  );
}

/** A phone with the guest's QR. */
function ArtPhone() {
  return (
    <span className="border-foreground bg-card relative flex h-28 w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-2xl border-[3px] shadow-sm">
      <span className="bg-foreground absolute top-1.5 h-1 w-5 rounded-full" />
      <QrCode className="text-foreground h-11 w-11" strokeWidth={1.75} />
    </span>
  );
}

/** A printed bill: its lines, the last one bold. */
function ArtBill({ lines }: { lines: { label: string; value: string; green?: boolean }[] }) {
  return (
    <span className="bg-card flex w-40 min-w-0 flex-col gap-1.5 rounded-xl px-3 py-3 text-sm tabular-nums shadow-sm">
      {lines.map((l, i) => (
        <span
          key={l.label}
          className={cn(
            "flex items-center justify-between gap-3",
            i === lines.length - 1 ? "border-border text-foreground border-t pt-1.5 font-bold" : l.green ? "font-semibold text-[#00A85A]" : "text-muted-foreground",
          )}
        >
          <span>{l.label}</span>
          <span>{l.value}</span>
        </span>
      ))}
    </span>
  );
}

/** The guest's credit at the place: the Wallet's black card. */
function ArtCredit({ label, amount }: { label: string; amount: string }) {
  return (
    <span className="bg-foreground text-background flex h-[5.5rem] w-40 min-w-0 flex-col justify-between rounded-2xl px-4 py-3 shadow-sm">
      <span className="flex items-center justify-between text-sm">
        {label}
        <Wallet className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <span className="text-2xl leading-none font-bold tabular-nums">{amount}</span>
    </span>
  );
}

function ArtArrow() {
  return <ArrowRight className="text-muted-foreground h-5 w-5 shrink-0" strokeWidth={2.5} />;
}

function ArtClock({ text }: { text: string }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span className="bg-card text-foreground flex h-14 w-14 items-center justify-center rounded-full shadow-sm">
        <Clock className="h-7 w-7" strokeWidth={2} />
      </span>
      <span className="text-foreground text-sm font-semibold">{text}</span>
    </span>
  );
}

/** Pay's How it works: cashback only (Pato, 2026-11-27, MESITA-5067:
 *  Discount is gone; cashback is how a guest starts coming back). */
function PayHowItWorks({ bps }: { bps: number }) {
  const rate = `${bps / 100}%`;
  const gives = (EXAMPLE_BILL * bps) / 10000;
  return (
    <HowItWorks
      tab="pay"
      title="How it works"
      lead="Part of what you pay here comes back as credits for your next visit."
    >
      <Scenes note="The tip and the part you pay with credits earn nothing back, and one bill earns $1,000 at most. Your credit never expires.">
        <Scene n={1} tint="cashback" art={<ArtPhone />} title="Show your QR" text="When you want the bill, open Pay and show your QR to your waiter. Check the bill on your phone and tap Accept." />
        <Scene
          n={2}
          tint="cashback"
          art={
            <>
              <Banknote className="text-foreground h-14 w-14" strokeWidth={1.5} />
              <CreditCard className="text-foreground h-14 w-14" strokeWidth={1.5} />
            </>
          }
          title={`Pay your waiter $${EXAMPLE_BILL}`}
          text="Cash or card, like always. Your waiter confirms it."
        />
        <Scene
          n={3}
          tint="cashback"
          art={
            <>
              <ArtClock text="1 hour" />
              <ArtArrow />
              <ArtCredit label={`${rate} back`} amount={`+$${gives}`} />
            </>
          }
          title={`Get $${gives} back`}
          text="One hour later it is in your Wallet. Use it on any bill at this place."
        />
      </Scenes>
    </HowItWorks>
  );
}

/** Prepay's How it works, on one of this place's own offers: the middle one. */
function PrepayHowItWorks({ products, co }: { products: Product[]; co: Checkout }) {
  const { catalog, currency } = co;
  const p = products[Math.floor((products.length - 1) / 2)];
  if (!p) return null;
  const line = catalog[p.key];
  const pay = whole(priceValue(p, line, currency));
  const get = whole(creditValue(p, line, currency));
  return (
    <HowItWorks tab="prepay" title="How Add Credits works" lead="Add credits now and get a bonus to spend here on your next visits.">
      <Scenes note="Your credit pays any bill at this place, never the tip, and never expires. You can also send it to a friend as a gift.">
        <Scene
          n={1}
          tint="prepay"
          art={
            <>
              <span className="flex h-[5.5rem] w-[5.5rem] flex-col items-center justify-center rounded-2xl bg-[#635BFF] text-2xl font-bold text-white tabular-nums shadow-sm">
                {bonusValue(p, line)}
              </span>
              <span className="text-foreground flex flex-col text-left">
                <span className="text-base font-semibold">{p.short}</span>
                <span className="text-2xl leading-tight font-bold tabular-nums">Pay {pay}</span>
              </span>
            </>
          }
          title={`Pay ${pay}`}
          text="Pick a bonus with the + button and pay with your card. The bigger it is, the more you get."
        />
        <Scene
          n={2}
          tint="prepay"
          art={
            <>
              <ArtClock text="3 hours" />
              <ArtArrow />
              <ArtCredit label="Credits" amount={get} />
            </>
          }
          title={`Get ${get}`}
          text="What you paid and your bonus arrive together in your Wallet, 3 hours later. You don't have to do anything."
        />
        <Scene
          n={3}
          tint="prepay"
          art={
            <>
              <ArtPhone />
              <ArtArrow />
              <ArtBill
                lines={[
                  { label: "Bill", value: "$200" },
                  { label: "Credits", value: "−$200", green: true },
                  { label: "You pay", value: "$0" },
                ]}
              />
            </>
          }
          title="Spend it here"
          text="When you want the bill, open Pay and show your QR to your waiter. Your credits are used first and you pay only what is left, plus the tip."
        />
      </Scenes>
    </HowItWorks>
  );
}

/** ADD · PAY (Pato, 2026-11-27, MESITA-5071: "Prepay" became Add; the
 *  `prepay` key and `?rewards=` values stay so old links open).
 *  TWO SUBPAGES, PREPAY · PAY (MESITA-4710; Post went with Stories,
 *  MESITA-4766): Prepay sells the vouchers, Pay is paying the bill here and
 *  the cashback it earns. What a guest earned stays on the Loyalty Card and
 *  Tickets. */
export type OffersTab = "prepay" | "pay";

// THE TABS' ICONS (Pato, 2026-11-23, MESITA-4726): Prepay the discount badge (MESITA-4844; the wallet, credit
// loaded ahead, before), Pay a receipt (the bill).
const OFFERS_TABS: { id: OffersTab; word: string; Icon: ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { id: "prepay", word: "Add", Icon: Percent },
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
        No Add offers yet.
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
                const why = blocked ? offerStatus(p.key, false, guestLock(p.key), unavailable[p.key]).text : "";
                const n = basket[p.key] ?? 0;
                // A PRODUCT ROW (Pato, 2026-11-22, MESITA-4647): left ONE
                // green box, black "+10%" over "BONUS"; the name and the deal
                // (no (i), MESITA-4804); − n + at the right. A blocked row says why,
                // with a lock, and has no stepper.
                return (
                  <li key={p.key} data-voucher={p.key} className={cn("flex min-h-16 items-center gap-2.5 px-3 py-2", blocked && dim && "opacity-50")}>
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
                      {/* Just "+10%": the name says Bonus (MESITA-4875). */}
                      <span className="text-lg leading-none font-bold tracking-tight">{bonus}</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex min-w-0 items-center gap-1">
                        <span className={cn("truncate text-lg leading-tight font-semibold", blocked ? "text-muted-foreground" : "text-foreground")}>{p.short}</span>
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

/** PAY (MESITA-4710; one card since MESITA-5071): the rate this guest gets
 *  on their next bill, How it works, then Pay Bill at the bottom
 *  (MESITA-4699). Nothing to buy: a confirmed bill earns it, 1 hour later. */
function CheckoutSection({
  cashback,
  loading,
  onPay,
}: {
  cashback: PlaceCashback | null;
  loading: boolean;
  onPay: (() => void) | undefined;
}) {
  const card = payCard(cashback);
  return (
    <>
      {loading ? (
        <BoneRows n={1} />
      ) : card ? (
        <PayCardView card={card} />
      ) : (
        // Nothing back here, or the read failed: Pay Bill still works.
        <p className={cn(CARD, "text-muted-foreground shrink-0 px-4 py-6 text-center text-sm")} data-offers-none="pay">
          No Pay offers yet.
        </p>
      )}
      {card ? <PayHowItWorks bps={card.bps} /> : null}
      {/* PAY BILL UNDER CHECKOUT (Pato, 2026-11-22, MESITA-4699), sticky like
          Add's Pay bar; "Pay Bill", not "Go to Pay Bill" (MESITA-5071).
          Absent onPay (admin's preview), no bar. */}
      {onPay ? (
        <div className="bg-card border-border sticky bottom-0 z-10 -mx-4 mt-auto -mb-4 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" data-cashback-pay-bar>
          <button
            type="button"
            onClick={onPay}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#00D66F] text-base font-semibold text-neutral-950 hover:bg-[#00c265]"
            data-cashback-pay-bill
          >
            <QrCode className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            Pay Bill
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
  const [full, setFull] = useState(false);
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
      if (out === "full") setFull(true);
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
    <div className="-mx-4 flex flex-1 shrink-0 flex-col pb-4" data-promos-page>
      <OffersTabs tab={tab} onTab={switchTab} locked={locked} picked={count} barRef={barRef} />
      <div
        role="tabpanel"
        id={`offers-panel-${tab}`}
        aria-labelledby={`offers-tab-${tab}`}
        // ONE GAP (Pato, 2026-11-23, MESITA-4787: "keep same margins"): the
        // switch's own pb-3 is the 12px to the list, as the host's pt-3 is
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
          />
        )}
        {/* ONE LINE ON EVERY TAB (MESITA-5071). */}
        <p className="text-muted-foreground shrink-0 text-center text-sm" data-offers-footer>
          Credits work only here and never expire.
        </p>
      </div>
      {full ? <PlaceFull name={place.name} onClose={() => setFull(false)} /> : null}
    </div>
  );
}

/** THE PLACE IS FULL (Pato, 2026-11-24, MESITA-4923: "a more prettier
 *  notification when the place is full and has issued enough credit"): a
 *  centred white window, not a red toast. The limit counts this basket, so a
 *  smaller one may still fit; the basket stays. */
function PlaceFull({ name, onClose }: { name: string; onClose: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const host = document.getElementById("mesita-app-card");
  return createPortal(
    <div className={cn(host ? "absolute" : "fixed", "inset-0 z-[135] flex items-center justify-center bg-black/40 p-6")} onClick={onClose} data-place-full>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="place-full-title"
        aria-describedby="place-full-line"
        className="bg-card flex w-full max-w-sm cursor-auto flex-col items-center gap-2 rounded-2xl p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-[#635BFF]/10 text-[#635BFF]">
          <Ticket className="h-8 w-8" strokeWidth={2.25} aria-hidden />
        </span>
        <h2 id="place-full-title" className="text-foreground text-xl font-bold">
          Full for now
        </h2>
        <p id="place-full-line" className="text-muted-foreground text-base leading-snug">
          {name} can&apos;t give out this much credit right now. You weren&apos;t charged. Try fewer bonuses, or come back later.
        </p>
        <button
          ref={button}
          type="button"
          onClick={onClose}
          className="bg-foreground text-paper mt-4 flex h-12 w-full items-center justify-center rounded-full text-base font-semibold"
        >
          Got it
        </button>
      </div>
    </div>,
    host ?? document.body,
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
