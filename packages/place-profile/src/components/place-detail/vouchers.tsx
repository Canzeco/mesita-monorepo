"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, CircleCheck, Crown, Lock, PartyPopper, Ticket, X, type LucideIcon } from "lucide-react";
import { isCardExpired, type PayCards } from "../../pay-cards";
import { Instagram } from "../brand-icons";

import type { PlaceActions } from "../../actions";
import { cn } from "../../lib/format";
import {
  PLACE_META_CLASS,
} from "../../lib/ui";
import { VOUCHER_TONE } from "../../lib/offers";
import { MONEY_VOUCHER_KEYS, moneyState, type MoneyVoucherKey, NOT_YET_SELLABLE, STORY_MIN_FOLLOWERS, type VoucherReason } from "../../money-state";
import type { PlaceDetail, VoucherCatalogLine } from "../../place-detail";

// THE VOUCHERS TAB IS SIX DIGITAL PRODUCTS IN ONE VERTICAL LIST (Pato,
// MESITA-3309: "Make the Vouchers graphics. It must look like 6 digital
// products"; then MESITA-3310, with the two shelves scrolling sideways:
// "Make the vouchers vertical, not scrollable horizontally. Just a list of
// 6 items vertical"). The six vouchers are one catalog on the server
// (VOUCHER_CATALOG, MESITA-3302) and the six cards Business › Payments draws
// (MESITA-3298): Standard MX$200 · MX$1,000 · MX$5,000 and Special Welcome ·
// Story · VIP, each with the same mark and colour on both sides (one mark
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
// have the same icon and the same color. the deals that have different
// colors are welcome and story VIP"); the specials keep their own. Under the title, one
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
// THE STANDARD THREE ARE NAMED, NOT PRICED (Pato, MESITA-3362: "the name
// of the thing should be Welcome, Story, VIP, Standard, Medium Standard,
// Large Standard"): the deal line carries the amounts.
const STANDARD: Product[] = [
  // SMALL · MEDIUM · BIG (Pato, 2026-11-15, MESITA-4056): MX$200 +10%,
  // MX$500 +20% (the voucher_5000 key), MX$1,000 +30%. EACH KEY ITS PRICE
  // (Pato, 2026-11-16, MESITA-4152): Small MX$200 +10%, Medium MX$1,000 +20%
  // (voucher_1000), Big MX$5,000 +30% (voucher_5000).
  { key: "voucher_200", name: "Small", line: "Pay $200.00MX, get $220.00MX.", limit: "As many as you like.", bonus: "10% bonus", short: "Small", brief: "As many as you like" },
  { key: "voucher_1000", name: "Medium", line: "Pay $1,000.00MX, get $1,200.00MX.", limit: "As many as you like.", bonus: "20% bonus", short: "Medium", brief: "As many as you like" },
  { key: "voucher_5000", name: "Big", line: "Pay $5,000.00MX, get $6,500.00MX.", limit: "As many as you like.", bonus: "30% bonus", short: "Big", brief: "As many as you like" },
];

const SPECIAL: Product[] = [
  { key: "voucher_welcome", name: "Welcome", line: "Pay $100.00MX, get $200.00MX.", limit: "One per place.", bonus: "100% bonus", short: "Welcome", brief: "One per place" },
  { key: "voucher_story", name: "Story", line: "Pay $100.00MX, get $150.00MX.", limit: "One per day.", bonus: "50% bonus", short: "Story", brief: "Post a story · 1/day" },
  { key: "voucher_vip", name: "VIP", line: "Pay $100.00MX, get $200.00MX.", when: "VIP guests only.", limit: "One per day.", bonus: "100% bonus", short: "VIP", brief: "VIP guests · 1/day" },
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
/** What a guest pays: the server's, else from the copy. */
function priceValue(product: Product, line: VoucherCatalogLine | undefined, currency: string): string {
  if (line) return pesos(line.price_cents, currency);
  const m = /Pay (\$[\d,.]+MX)/.exec(product.line);
  return m ? m[1] : product.name;
}

/** One tag per state, objective: where it stands for this guest at this place. */
function tag(reason: VoucherReason | undefined): string {
  if (!reason) return "Available here";
  if (reason === "off" || reason === "needs_account" || reason === "needs_house_credits" || reason === "needs_billing") return "Not at this place yet";
  if (reason === "paused") return "Paused for a moment";
  if (reason === "used") return "You had yours here";
  if (reason === "needs_visit") return "One per visit";
  return "Coming soon";
}


/** A section title on the one-screen Offers page: 16px (MESITA-3452). */
// The Panel heading's face since MESITA-4196 (16px display, as the Reserve page).
const OFFERS_TITLE_CLASS = "text-foreground font-display text-base leading-tight font-semibold tracking-tight";

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
  Mark?: LucideIcon | typeof Instagram;
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
    voucher_200: green,
    voucher_1000: green,
    voucher_5000: green,
    // ONE COLOUR PER KIND (Pato, 2026-11-16, MESITA-4207: "unlimited
    // voucher ... Green, but welcome make it blue, and story make it pink
    // like instagram"; soft tints). Every offer green from MESITA-4181.
    voucher_welcome: { ...green, card: VOUCHER_TONE.voucher_welcome, Mark: PartyPopper },
    voucher_story: { ...green, card: VOUCHER_TONE.voucher_story, Mark: Instagram },
    voucher_vip: { ...green, card: VOUCHER_TONE.voucher_vip, Mark: Crown },
  };
})();

function SectionTitle({ id, title }: { id: string; title: string }) {
  return (
    <h3 id={id} className={OFFERS_TITLE_CLASS}>
      {title}
    </h3>
  );
}

/** A locked offer's status line (MESITA-3502), the sheet's reason since
 *  MESITA-4224. */
type InfoStatus = { ok: boolean; text: string };

/** WHEN THE CREDITS ARRIVE (MESITA-3498, Pato: "Welcome, Story and VIP are
 *  activated immediately; the other vouchers take one hour ... Pay X, get Y
 *  in 1 hr ... Pay X, get Y instantly"). */
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

/** YOUR MONEY NOW, THE BONUS IN 3 HOURS (Pato, 2026-11-17, MESITA-4214):
 *  every voucher. The row and the button say only "Pay $X · Get $Y"; the (i)
 *  says when each part is ready. Story's money waits for its story. */
function readyIn(key: MoneyVoucherKey): string {
  return key === "voucher_story" ? "after story, bonus 3 hr later" : "bonus in 3 hr";
}

/** The (i)'s "Your status" line for a prepayment offer (MESITA-3502). */
function offerStatus(
  key: MoneyVoucherKey,
  can: boolean,
  lock: "vip" | "instagram" | "followers" | null,
  reason: VoucherReason | undefined,
): InfoStatus {
  if (lock === "vip") return { ok: false, text: "You're not in the VIP Class yet." };
  if (lock === "instagram") return { ok: false, text: "Link your Instagram to use Story offers." };
  if (lock === "followers") return { ok: false, text: `Your Instagram needs more than ${STORY_MIN_FOLLOWERS.toLocaleString("en-US")} followers.` };
  if (can) {
    if (key === "voucher_vip") return { ok: true, text: "You're in the VIP Class. You can buy this." };
    if (key === "voucher_welcome") return { ok: true, text: "Available: one per place." };
    if (key === "voucher_story") return { ok: true, text: "Available. One per visit." };
    return { ok: true, text: "Available. Buy as many as you like." };
  }
  if (reason === "used") return { ok: false, text: "You already had yours here." };
  // MESITA-3463: a visit is a paid bill here with a card part.
  if (reason === "needs_visit") return { ok: false, text: "One per visit. Pay a bill here by card to buy another." };
  return { ok: false, text: `${tag(reason)}.` };
}

/** The Offers page (MESITA-3412: the host's sheet off Prepay; it was the
 *  fourth tab). Prepayments only since MESITA-4062. */
type GuestLock = "vip" | "instagram" | "followers" | null;

/** Who may buy what, once for every list of the six vouchers (VouchersPane,
 *  and the House Card's Vouchers via voucherOffers, MESITA-3822). */
function offerRules(money: PlaceDetail["money"], guest: PlaceActions["guest"]) {
  // A Google-only card or an older read has no money: every switch reads off.
  // Only `unavailable` is valid from this local call: the read strips
  // `pay_cards`, so its mesita_pay is not the server's.
  const state = moneyState(
    {
      // House Credits as the server says; an older read without it is
      // read as on, so the server's own unavailable reasons stand.
      house_credits: money?.house_credits !== false,
      voucher_200: money?.vouchers.voucher_200 === true,
      voucher_1000: money?.vouchers.voucher_1000 === true,
      voucher_5000: money?.vouchers.voucher_5000 === true,
      voucher_welcome: money?.vouchers.voucher_welcome === true,
      voucher_story: money?.vouchers.voucher_story === true,
      voucher_vip: money?.vouchers.voucher_vip === true,
    },
    money ? { charges_enabled: money.charges_enabled } : null,
    null,
  );
  // What sells is the server's word (`sell`, with the kill switch and
  // Welcome-once applied); a read without it sells nothing.
  const unavailable: Partial<Record<MoneyVoucherKey, VoucherReason>> = { ...state.unavailable };
  for (const k of state.sell) {
    if (!money?.sell.includes(k)) unavailable[k] = money?.unavailable[k] ?? "needs_account";
  }
  // IN TEST MODE NOTHING IS GREYED (Pato, MESITA-3334); live mode dims a row
  // not for sale.
  const dim = money?.test_mode !== true;
  // THE GUEST'S OWN LOCKS (MESITA-3502): VIP is for the VIP Class, Story needs
  // a linked Instagram. Unknown guest (no profile read), no lock.
  const guestLock = (k: MoneyVoucherKey): GuestLock => {
    if (!guest) return null;
    if (k === "voucher_vip" && !guest.vip) return "vip";
    if (k === "voucher_story" && !guest.instagramLinked) return "instagram";
    // MESITA-3507: the server refuses Story at STORY_MIN_FOLLOWERS or fewer.
    if (k === "voucher_story" && guest.instagramFollowers != null && guest.instagramFollowers <= STORY_MIN_FOLLOWERS) {
      return "followers";
    }
    return null;
  };
  // Buyable: for sale, or in test mode any row the server has not used up or
  // paused (Pato, MESITA-3342: "must be buyable or whatever").
  const buyable = (k: MoneyVoucherKey) => {
    if (guestLock(k)) return false;
    // A parked voucher (NOT_YET_SELLABLE, VIP today) is shown but stays
    // locked even in test mode; the server refuses the buy (MESITA-4220).
    if (NOT_YET_SELLABLE[k]) return false;
    const reason = unavailable[k];
    return reason === undefined || (!dim && reason !== "used" && reason !== "paused" && reason !== "needs_visit");
  };
  return { unavailable, dim, guestLock, buyable };
}

/** One of the six vouchers as a row elsewhere (the House Card, MESITA-3822):
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
  /** "bonus in 3 hr" or "after story, bonus 3 hr later" (MESITA-4214). */
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
 *  rename"): SPECIAL OFFERS (Welcome one per place, Story and VIP one per
 *  visit), then CLASSIC OFFERS, the three sizes, as many as you like (Pato,
 *  2026-11-17, MESITA-4218: "Classic Offers · Special Offers"; Standard Offers
 *  in MESITA-4216; Limited and
 *  Unlimited Vouchers in MESITA-4203).
 *  What the guest paid is ready at once, the bonus 3 hours later (MESITA-4214).
 *  Instant / Prepayment Vouchers in MESITA-4198. One "Prepaid Vouchers" group from MESITA-4173,
 *  Special and Bonus Vouchers in MESITA-4154. The host still opens it by
 *  `?rewards=prepayment` or `?rewards=special`. */
const GROUPS: { id: "special" | "prepayment"; title: string; keys: ReadonlySet<MoneyVoucherKey> }[] = [
  {
    id: "special",
    title: "Special Offers",
    keys: new Set(["voucher_welcome", "voucher_story", "voucher_vip"]),
  },
  {
    id: "prepayment",
    title: "Classic Offers",
    keys: new Set(["voucher_200", "voucher_1000", "voucher_5000"]),
  },
];

/** The vouchers a guest is shown: EVERY ONE, LOCKED OR NOT (Pato,
 *  2026-11-17, MESITA-4220: "DISPLAY VIP EVEN IF BLOCKED"). A voucher not on
 *  sale yet (money-state's VIP today) is a locked row, never
 *  a missing one; it was dropped from the page from MESITA-3831. */
function listedProducts(): Product[] {
  // Welcome, Story, VIP, Small, Medium, Big (MESITA-4154: the specials lead).
  return [...SPECIAL, ...STANDARD];
}

/** The vouchers in the Offers page's order, Welcome · VIP · Small · Medium · Big (MESITA-4154)
 *  (MESITA-3834). */
export function voucherOffers(money: PlaceDetail["money"], guest?: PlaceActions["guest"]): VoucherOffer[] {
  const { unavailable, dim, guestLock, buyable } = offerRules(money, guest);
  const catalog = money?.catalog ?? {};
  const currency = money?.currency ?? "mxn";
  return listedProducts().map((p) => {
    const line = catalog[p.key];
    const can = buyable(p.key);
    const status = offerStatus(p.key, can, guestLock(p.key), unavailable[p.key]);
    return {
      key: p.key,
      title: p.short,
      chipClass: FACES[p.key].card,
      bonus: `+${p.bonus.replace(/ bonus$/, "")}`,
      pay: priceValue(p, line, currency),
      get: creditValue(p, line, currency),
      ready: readyIn(p.key),
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

/** The sheet's facts (Pato, 2026-11-17, MESITA-4224: "when you click and open
 *  modal, then you understand"): when the money is ready, when the bonus is,
 *  where it spends, who may buy it. The rows say only the deal. */
function sheetFacts(key: MoneyVoucherKey, pay: string, bonus: string | null): string[] {
  const later = bonus ? `The ${bonus} bonus is ready 3 hours later.` : "The bonus is ready 3 hours later.";
  const first = key === "voucher_story"
    ? `Post an Instagram story at the place tagging it and show it to the staff. Your ${pay} is ready then.`
    : `Your ${pay} is ready to spend as soon as you pay.`;
  return [first, later, "Spend it on any bill here, all of it or part. It never expires.", sheetLimit(key)];
}

function sheetLimit(key: MoneyVoucherKey): string {
  if (key === "voucher_welcome") return "One per place, if you haven't paid here before.";
  if (key === "voucher_story") return "For Instagram accounts over 1,000 followers. One per visit.";
  if (key === "voucher_vip") return "For guests in Mesita's VIP Class. One per visit.";
  return "Buy as many as you like.";
}

type Receipt = { outcome: "paid" | "processing"; pay: string; bonus: string | null; readyAt: string | null };

/** THE PAY SHEET (Pato, 2026-11-17, MESITA-4224: "simply click a button and
 *  the offer you select opens a modal and in that modal you click to pay and
 *  you receive explanation"): a bottom sheet in the app card (Pay in thumb
 *  reach), the product's face, the deal, the facts, the card, one black Pay.
 *  A locked offer opens it too, its reason where Pay goes. Paid, it turns
 *  into a receipt. Escape or a tap outside closes it; focus returns to the
 *  row that opened it.
 *  decision: a sheet in the package, against apps/web-consumer › Overlays
 *  (MESITA-4094, pages not sheets): Pato's live call in the design review. */
function PaySheet({
  product,
  placeName,
  pay,
  get,
  bonus,
  bonusAmount,
  can,
  status,
  unlock,
  live,
  buying,
  payCards,
  payCard,
  canChange,
  onChangeCard,
  onRetryCards,
  signedOut,
  onPay,
  onClose,
}: {
  product: Product;
  placeName: string;
  pay: string;
  get: string;
  bonus: string;
  bonusAmount: string | null;
  can: boolean;
  status: InfoStatus;
  unlock: { label: string; onClick: () => void } | null;
  live: boolean;
  buying: boolean;
  payCards: PayCards | undefined;
  payCard: { label: string; last4: string } | null;
  canChange: boolean;
  onChangeCard: () => void;
  onRetryCards?: () => void;
  signedOut: boolean;
  onPay: () => Promise<Receipt | null>;
  onClose: () => void;
}) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const face = FACES[product.key];
  const Mark = face.Mark ?? Ticket;
  const cardsPending = payCards !== undefined && payCards.state !== "ready";
  const needsCard = payCards?.state === "ready" && payCard === null;
  const host = typeof document !== "undefined" ? document.getElementById("mesita-app-card") : null;
  const button = signedOut ? "Sign in to buy" : buying ? "Paying…" : needsCard ? "Add a card to pay" : `Pay ${whole(pay)}`;
  const press = async () => {
    const r = await onPay();
    if (r) setReceipt(r);
  };
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className={cn(host ? "absolute" : "fixed", "inset-0 z-[135] flex flex-col justify-end bg-black/40")}
      onClick={onClose}
      data-offer-sheet={product.key}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-sheet-title"
        tabIndex={-1}
        className="bg-card flex max-h-[90%] w-full flex-col gap-4 overflow-y-auto rounded-t-3xl px-5 pt-2 pb-5 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="bg-border mx-auto h-1 w-10 shrink-0 rounded-full" aria-hidden />
        <div className="flex items-center gap-3">
          <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl", face.card)} aria-hidden>
            <Mark className="h-7 w-7" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="offer-sheet-title" className="text-foreground text-lg leading-tight font-bold">{product.short}</h3>
            <p className="text-muted-foreground truncate text-sm">{placeName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          >
            <X className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </div>

        {receipt ? (
          // THE RECEIPT (MESITA-4224, D5): what landed now and what lands later.
          <div className="flex flex-col gap-4" role="status" data-offer-receipt={receipt.outcome}>
            <div className="flex items-center gap-3">
              <CircleCheck className="h-8 w-8 shrink-0 text-[#00A85A]" strokeWidth={2.25} aria-hidden />
              <p className="text-foreground text-xl font-bold tabular-nums">
                {receipt.outcome === "paid" ? `Paid ${whole(receipt.pay)}` : "Your bank is confirming"}
              </p>
            </div>
            <ul className="text-foreground flex flex-col gap-2 text-[15px] leading-snug">
              {receipt.outcome === "paid" ? (
                <>
                  <li className="tabular-nums">
                    {product.key === "voucher_story"
                      ? `${whole(receipt.pay)} is ready once you show your story.`
                      : `${whole(receipt.pay)} is ready to spend now.`}
                  </li>
                  <li className="tabular-nums">
                    {receipt.bonus ? `The ${receipt.bonus} bonus` : "The bonus"}
                    {receipt.readyAt && product.key !== "voucher_story" ? ` is ready at ${readyClock(receipt.readyAt)}.` : " is ready 3 hours later."}
                  </li>
                </>
              ) : (
                <li>The credit shows here once it&apos;s through. You won&apos;t be charged twice.</li>
              )}
            </ul>
            <button
              type="button"
              onClick={onClose}
              autoFocus
              className="bg-foreground text-paper h-12 w-full rounded-xl text-base font-semibold hover:opacity-90"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="bg-background flex items-end justify-between gap-3 rounded-2xl px-4 py-3">
              <div className="flex flex-col">
                <span className="text-muted-foreground text-sm">You pay</span>
                <span className="text-foreground text-2xl font-bold tabular-nums">{whole(pay)}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-muted-foreground text-sm">
                  You get <span className="text-foreground font-semibold">{bonus}</span>
                </span>
                <span className="text-2xl font-extrabold text-[#00A85A] tabular-nums">{whole(get)}</span>
              </div>
            </div>
            <ul className="text-foreground flex flex-col gap-2 text-[15px] leading-snug">
              {sheetFacts(product.key, whole(pay), bonusAmount ? whole(bonusAmount) : null).map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="bg-foreground mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            {can ? (
              <div className="flex flex-col gap-3">
                {payCard && !signedOut ? (
                  <p className="flex items-center justify-between text-[15px]" data-pay-card-line>
                    <span className="text-foreground truncate font-medium">
                      {payCard.label} •••• {payCard.last4}
                    </span>
                    {canChange ? (
                      <button
                        type="button"
                        disabled={buying}
                        onClick={onChangeCard}
                        className="text-foreground shrink-0 font-semibold underline underline-offset-2 disabled:opacity-50"
                      >
                        Change
                      </button>
                    ) : null}
                  </p>
                ) : null}
                {payCards?.state === "error" ? (
                  <p className="flex items-center justify-between text-[15px]" role="alert">
                    <span className="text-foreground">Couldn&apos;t load your cards</span>
                    <button type="button" onClick={onRetryCards} className="text-foreground shrink-0 font-semibold underline underline-offset-2">
                      Retry
                    </button>
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void press()}
                  disabled={!live || buying || cardsPending}
                  className="bg-foreground text-paper disabled:bg-muted disabled:text-muted-foreground h-12 w-full rounded-xl text-base font-semibold tabular-nums hover:opacity-90"
                  data-voucher-buy={product.key}
                >
                  {button}
                </button>
              </div>
            ) : (
              // LOCKED (MESITA-4224, D4): the reason where Pay goes, and the one
              // action that unlocks it when there is one.
              <div className="flex flex-col gap-3">
                <p className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-amber-900" data-offer-status="locked">
                  <Lock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                  <span className="text-[15px] leading-snug font-semibold">{status.text}</span>
                </p>
                {unlock ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      unlock.onClick();
                    }}
                    className="bg-foreground text-paper h-12 w-full rounded-xl text-base font-semibold hover:opacity-90"
                    data-offer-action
                  >
                    {unlock.label}
                  </button>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    host ?? document.body,
  );
}

export function VouchersPane({
  place,
  actions,
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
}) {
  const onLoad = actions?.onLoadVouchers;
  useEffect(() => {
    onLoad?.();
  }, [onLoad]);

  const money = place.money;
  // The host is still asking list-vouchers and the place read carried no
  // offer: draw the rows, never a guess (MESITA-3388).
  const loading = actions?.vouchersLoading === true && !money;
  const { unavailable, dim, guestLock, buyable } = offerRules(money, actions?.guest);
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

  // A TAP OPENS THE SHEET (MESITA-4224): no tick, no foot Pay. A Home chip's
  // voucher (MESITA-4207) opens its sheet at once.
  const asked = actions?.askedVoucher;
  const [open, setOpen] = useState<MoneyVoucherKey | null>(() =>
    asked && (MONEY_VOUCHER_KEYS as readonly string[]).includes(asked) ? (asked as MoneyVoucherKey) : null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const close = useCallback(() => {
    setOpen(null);
    opener.current?.focus();
  }, []);

  const products = listedProducts();

  const sheetProduct = open && !loading ? products.find((p) => p.key === open) ?? null : null;
  let sheet: ReactNode = null;
  if (sheetProduct) {
    const p = sheetProduct;
    const line = catalog[p.key];
    const pay = priceValue(p, line, currency);
    const get = creditValue(p, line, currency);
    const can = buyable(p.key);
    const lock = guestLock(p.key);
    const unlock = lock === "vip" && actions?.onJoinVip
      ? { label: "Request VIP", onClick: actions.onJoinVip }
      : lock === "instagram" && actions?.onLinkInstagram
        ? { label: "Link Instagram", onClick: actions.onLinkInstagram }
        : null;
    const bonusAmount = line ? pesos(line.bonus_cents, currency) : null;
    const onPay = async (): Promise<Receipt | null> => {
      if (!live) return null;
      const out = await actions?.onBuyVoucher?.([{ voucher: p.key, qty: 1 }], signedOut ? null : payCard?.id ?? null);
      if (out !== "paid" && out !== "processing") return null;
      const readyAt = line ? new Date(Date.now() + line.available_after_sec * 1000).toISOString() : null;
      return { outcome: out, pay, bonus: bonusAmount ? whole(bonusAmount) : null, readyAt };
    };
    sheet = (
      <PaySheet
        product={p}
        placeName={place.name}
        pay={pay}
        get={get}
        bonus={`+${p.bonus.replace(/ bonus$/, "")}`}
        bonusAmount={bonusAmount}
        can={can}
        status={offerStatus(p.key, can, lock, unavailable[p.key])}
        unlock={unlock}
        live={live}
        buying={buying}
        payCards={payCards}
        payCard={payCard}
        canChange={usableCards.length > 1}
        onChangeCard={nextCard}
        onRetryCards={actions?.onRetryPayCards}
        signedOut={signedOut}
        onPay={onPay}
        onClose={close}
      />
    );
  }

  return (
    // ON THE GREY PAGE (MESITA-4196): two white panels, Special then Classic
    // (MESITA-4218).
    <div className="-mx-4 -mt-4 flex flex-1 shrink-0 flex-col gap-3 px-4 pt-4 pb-4" data-promos-page>
      {GROUPS.map((g) => {
        const list = products.filter((p) => g.keys.has(p.key));
        if (list.length === 0) return null;
        return (
          <section key={g.id} className={cn(CARD, "shrink-0 overflow-hidden")} aria-labelledby={`rewards-${g.id}`} data-promos={g.id}>
            <div className="px-4 pt-3 pb-2">
              <SectionTitle id={`rewards-${g.id}`} title={g.title} />
            </div>
            <ul className="border-border divide-border divide-y border-t" data-voucher-catalog>
              {list.map((p) => {
                const line = catalog[p.key];
                const pay = priceValue(p, line, currency);
                const get = creditValue(p, line, currency);
                const can = !loading && buyable(p.key);
                const face = FACES[p.key];
                const Mark = face.Mark ?? Ticket;
                const bonus = `+${p.bonus.replace(/ bonus$/, "")}`;
                const locked = !loading && !can;
                const why = locked ? offerStatus(p.key, false, guestLock(p.key), unavailable[p.key]).text : "";
                // A PRODUCT ROW (Pato, 2026-11-17, MESITA-4224: "offers must
                // really look like products, like item products"; D8): the
                // product's face, its name, the deal, the bonus in ink, an
                // arrow. Colour on the face only; no tick, no (i), no pill.
                return (
                  <li key={p.key} data-voucher={p.key} className={cn(locked && dim && "opacity-50")}>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={(e) => {
                        opener.current = e.currentTarget;
                        setOpen(p.key);
                      }}
                      aria-haspopup="dialog"
                      aria-label={`${p.short}, pay ${whole(pay)}, get ${whole(get)}, ${bonus} bonus${locked ? `. ${why}` : ""}`}
                      className="hover:bg-muted/50 flex min-h-[4.5rem] w-full cursor-pointer items-center gap-3 px-3.5 py-2 text-left"
                    >
                      <span className={cn("relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl", face.card)} aria-hidden>
                        <Mark className="h-7 w-7" strokeWidth={2.25} />
                        {locked ? (
                          <span className="bg-card text-foreground absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full shadow-sm" data-voucher-locked>
                            <Lock className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </span>
                        ) : null}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col" aria-hidden>
                        {/* IN A BOX, SAYING BONUS (Pato, 2026-11-17, MESITA-4227:
                            "the bonus amount must be in a box and must mention
                            bonus even if repeated a lot of times"): ink on a grey
                            box beside the name, so the face stays the row's one
                            colour and the deal keeps the full width under it (at
                            the right it cut "Get $6,500" on a 390px phone). */}
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="text-foreground truncate text-base font-semibold">{p.short}</span>
                          <span
                            className="bg-muted text-foreground border-border shrink-0 rounded-md border px-1.5 py-0.5 text-[13px] leading-tight font-extrabold tracking-tight whitespace-nowrap tabular-nums"
                            data-offer-bonus
                          >
                            {bonus} Bonus
                          </span>
                        </span>
                        {/* IN INK (Pato, 2026-11-17, MESITA-4227: "the pay and
                            get must be clearer, it's too transparent"): Pay
                            medium, Get semibold, only the dot grey. */}
                        <span className="text-foreground truncate text-[15px] font-medium tabular-nums">
                          Pay {whole(pay)} <span className="text-muted-foreground">·</span>{" "}
                          <span className="font-semibold">Get {whole(get)}</span>
                        </span>
                      </span>
                      <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {sheet}
    </div>
  );
}
