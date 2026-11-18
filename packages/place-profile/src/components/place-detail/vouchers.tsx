"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, CircleCheck, QrCode, Clock, Copy, CreditCard, Gift, Infinity as InfinityIcon, Lock, PartyPopper, Repeat, Repeat1, Ticket, Utensils, Wallet, X, type LucideIcon } from "lucide-react";
import { isCardExpired, type PayCards } from "../../pay-cards";
import { Instagram } from "../brand-icons";

import type { PlaceActions, StoryRefused, VoucherBuyOutcome } from "../../actions";
import {
  createStoryPoll,
  isStoryGateReason,
  postedAgo,
  STORY_POLL_DEFAULT,
  storySheetView,
  type StoryCheckAnswer,
  type StoryGateReason,
  type StoryPoll,
  type StoryReview,
} from "../../story-check";
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
  if (reason === "off" || reason === "needs_account" || reason === "needs_loyalty_cards" || reason === "needs_billing") return "Not at this place yet";
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
 *  says when each part is ready. Story's money is ready at once too since
 *  MESITA-4264; since MESITA-4296 the story is posted before Pay and its bonus
 *  lands 3 hours after payment if the story is still up. No staff. */
function readyIn(key: MoneyVoucherKey): string {
  return key === "voucher_story" ? "bonus 3 hr after you pay, if your story is still up" : "bonus in 3 hr";
}

/** The (i)'s "Your status" line for a prepayment offer (MESITA-3502). */
function offerStatus(
  key: MoneyVoucherKey,
  can: boolean,
  lock: "instagram" | "followers" | null,
  reason: VoucherReason | undefined,
): InfoStatus {
  if (lock === "instagram") return { ok: false, text: "Link your Instagram to use Story offers." };
  if (lock === "followers") return { ok: false, text: `Your Instagram needs more than ${STORY_MIN_FOLLOWERS.toLocaleString("en-US")} followers.` };
  if (can) {
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
type GuestLock = "instagram" | "followers" | null;

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
      voucher_200: money?.vouchers.voucher_200 === true,
      voucher_1000: money?.vouchers.voucher_1000 === true,
      voucher_5000: money?.vouchers.voucher_5000 === true,
      voucher_welcome: money?.vouchers.voucher_welcome === true,
      voucher_story: money?.vouchers.voucher_story === true,
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
  // THE GUEST'S OWN LOCKS (MESITA-3502): Story needs a linked Instagram with
  // enough followers; no offer names a Class (MESITA-4249). Unknown guest (no profile read), no lock.
  const guestLock = (k: MoneyVoucherKey): GuestLock => {
    if (!guest) return null;
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
    // A parked voucher (NOT_YET_SELLABLE, none today) is shown but stays
    // locked even in test mode; the server refuses the buy (MESITA-4220).
    if (NOT_YET_SELLABLE[k]) return false;
    const reason = unavailable[k];
    return reason === undefined || (!dim && reason !== "used" && reason !== "paused" && reason !== "needs_visit");
  };
  return { unavailable, dim, guestLock, buyable };
}

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
  /** "bonus in 3 hr", or Story's "bonus 3 hr after you pay, if your story is still up" (MESITA-4214, MESITA-4296). */
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
    keys: new Set(["voucher_welcome", "voucher_story"]),
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

/** HOW IT WORKS, IN THREE STEPS (Pato, 2026-11-17, MESITA-4299: "Write all
 *  the steps clearer ... 1. Pay X 2. Receive principal right now 3. Receive
 *  bonus in 3 hours. JUST THIS 3 STEPS"): each step is one thing that
 *  happens, its amount on the right of a bold line and one small line under
 *  it; the bonus step in green. Where the credit spends and that it never
 *  expires is one line under the steps, never a step. Welcome is the same
 *  three under a one-time notice. Story's own three put the post first
 *  (MESITA-4296), and who can get it is a checklist apart from the steps
 *  (Pato: "the Instagram voucher is just too hard"). The Right now · In 3
 *  hours · Anytime labels were MESITA-4290; each special's own first step
 *  MESITA-4234; four grey bullets MESITA-4224. */
type Step = {
  Icon: LucideIcon;
  title: string;
  /** The money this step moves, on the right of the title. */
  amount?: string;
  line: ReactNode;
  green?: boolean;
  /** Story's live sheet lights the step the guest is on and ticks the one done. */
  state?: "current" | "done";
};
/** The place's Instagram username from its stored URL, or null: the twin of
 *  supabase _shared/place-instagram.ts (MESITA-4291). */
export function instagramHandle(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const m = url.trim().match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i);
  return m ? m[1].toLowerCase() : null;
}

const CREDIT_LINE = "Ready to spend the second you pay.";

/** Small, Medium, Big and Welcome: pay, the credit now, the bonus in 3 hours. */
function sheetSteps(pay: string, bonus: string | null, card: { label: string; last4: string } | null): Step[] {
  return [
    { Icon: CreditCard, title: "Pay", amount: pay, line: card ? `With your ${card.label} ending ${card.last4}.` : "By card." },
    { Icon: Wallet, title: "Get your credit now", amount: pay, line: CREDIT_LINE },
    { Icon: Gift, title: "Get your bonus in 3 hours", amount: bonus ? `+${bonus}` : undefined, line: "Added by itself. Nothing to do.", green: true },
  ];
}

/** Story: post, the waiter approves, pay, keep it up (MESITA-4304). `stage`
 *  null draws no progress (a locked sheet, admin's preview); "post" lights
 *  Post; "waiter" ticks Post and lights the waiter; "pay" ticks both. */
function storySteps(pay: string, bonus: string | null, post: ReactNode, stage: "post" | "waiter" | "pay" | null): Step[] {
  const at = (mine: "post" | "waiter" | "pay"): Step["state"] => {
    if (stage === null) return undefined;
    const order = ["post", "waiter", "pay"];
    const i = order.indexOf(stage);
    const j = order.indexOf(mine);
    return j < i ? "done" : j === i ? "current" : undefined;
  };
  return [
    { Icon: Camera, title: "Post a story", line: post, state: at("post") },
    { Icon: QrCode, title: "Show it to the waiter", line: "They approve it with the waiter code.", state: at("waiter") },
    { Icon: CreditCard, title: "Pay, get your credit now", amount: pay, line: CREDIT_LINE, state: at("pay") },
    { Icon: Gift, title: "Keep it up 3 hours", amount: bonus ? `+${bonus}` : undefined, line: "Then your bonus is added by itself.", green: true },
  ];
}

/** The two names a Story tags, as one text to copy (MESITA-4291). */
function storyTags(handle: string | null): string {
  return handle ? `@mesita @${handle}` : "@mesita";
}

function storyPostLine(handle: string | null): string {
  return handle ? `Tag @mesita and @${handle} in it.` : "Tag @mesita and the place's Instagram in it.";
}

const SECTION_LABEL = "text-muted-foreground text-xs leading-tight font-bold tracking-wider uppercase";

/** The steps: a round icon and the line down to the next, the title with its
 *  amount, one small line. */
function StepList({ steps, dim }: { steps: Step[]; dim?: boolean }) {
  return (
    <ol className={cn("flex flex-col", dim && "opacity-50")} aria-label="How it works" data-offer-steps>
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-3" aria-current={s.state === "current" ? "step" : undefined} data-offer-step={s.state}>
          <span className="flex flex-col items-center" aria-hidden>
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
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
            {i < steps.length - 1 ? <span className="bg-border my-1 w-0.5 flex-1" /> : null}
          </span>
          <span className={cn("flex min-w-0 flex-1 flex-col pt-1.5", i < steps.length - 1 && "pb-4")}>
            <span className={cn("flex items-baseline justify-between gap-3 text-[17px] leading-snug font-bold tabular-nums", s.green ? "text-[#00A85A]" : "text-foreground")}>
              <span className="min-w-0">{s.title}</span>
              {s.amount ? <span className="shrink-0">{s.amount}</span> : null}
            </span>
            <span className="text-muted-foreground mt-0.5 text-sm leading-snug">{s.line}</span>
          </span>
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

/** GOOD TO KNOW (D3): every rule of the offer in one box, the limit with
 *  them; Welcome's one-time rule first and amber (MESITA-4299: "mention that
 *  this is only one"). The header carries no limit chip any more. */
function GoodToKnow({ productKey }: { productKey: MoneyVoucherKey }) {
  const rows: { Icon: LucideIcon; text: string; warn?: boolean }[] = [];
  if (productKey === "voucher_welcome") rows.push({ Icon: Clock, text: "One per guest at this place.", warn: true });
  rows.push({ Icon: Utensils, text: "Spend it on any bill here." }, { Icon: InfinityIcon, text: "It never expires." });
  if (productKey === "voucher_story") rows.push({ Icon: Repeat1, text: "One per visit." });
  else if (productKey !== "voucher_welcome") rows.push({ Icon: Repeat, text: "Buy as many as you like." });
  return (
    <Box title="Good to know" data-offer-good-to-know="">
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li
            key={r.text}
            className={cn(
              "flex items-start gap-2.5 text-[15px] leading-snug",
              r.warn ? "-mx-1 rounded-xl bg-amber-50 px-3 py-2 font-semibold text-amber-900" : "text-foreground",
            )}
            data-offer-once={r.warn ? "" : undefined}
          >
            <r.Icon className={cn("mt-0.5 h-[18px] w-[18px] shrink-0", !r.warn && "text-muted-foreground")} strokeWidth={2.25} aria-hidden />
            {r.text}
          </li>
        ))}
      </ul>
    </Box>
  );
}

/** WHO CAN GET A STORY (MESITA-4299): the three things the guest's Instagram
 *  needs, apart from the steps, each ticked, locked or not known yet. */
type StoryGuest = { linked: boolean | null; followers: number | null; handle: string | null };
type StoryFail = "instagram" | "private" | "followers" | null;
type Need = { label: string; state: "ok" | "locked" | "unknown" };

/** `passed`: the server's check let this guest through, so all three hold. */
function storyNeeds(guest: StoryGuest, failing: StoryFail, passed: boolean): Need[] {
  const state = (fail: StoryFail, known: boolean): Need["state"] => (failing === fail ? "locked" : passed || known ? "ok" : "unknown");
  const linked = failing !== "instagram" && (passed || guest.linked === true);
  return [
    { label: `Instagram linked${linked && guest.handle ? ` · @${guest.handle}` : ""}`, state: state("instagram", guest.linked === true) },
    { label: "Public account", state: state("private", false) },
    {
      label: `${STORY_MIN_FOLLOWERS.toLocaleString("en-US")}+ followers${guest.followers != null ? ` · you have ${guest.followers.toLocaleString("en-US")}` : ""}`,
      state: state("followers", guest.followers != null && guest.followers > STORY_MIN_FOLLOWERS),
    },
  ];
}

function NeedBox({ needs }: { needs: Need[] }) {
  return (
    <Box title="Who can get it" data-story-needs="">
      <ul className="flex flex-col gap-2">
        {needs.map((n) => (
          <li
            key={n.label}
            className={cn("flex items-center gap-2.5 text-[15px] leading-snug tabular-nums", n.state === "locked" ? "font-semibold text-amber-900" : "text-foreground")}
            data-story-need={n.state}
          >
            {n.state === "ok" ? (
              <CircleCheck className="h-5 w-5 shrink-0 text-[#00A85A]" strokeWidth={2.25} aria-hidden />
            ) : n.state === "locked" ? (
              <Lock className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
                <span className="bg-border h-2 w-2 rounded-full" />
              </span>
            )}
            <span>{n.label}</span>
            {n.state === "unknown" ? null : <span className="sr-only">{n.state === "ok" ? "(yes)" : "(missing)"}</span>}
          </li>
        ))}
      </ul>
    </Box>
  );
}

type Receipt = { outcome: "paid" | "processing"; pay: string; bonus: string | null; readyAt: string | null };

/** What a Pay ends in: a receipt, a Story refusal (back to the check), or
 *  nothing (the host already said why; the sheet stays). */
type PayResult = Receipt | StoryRefused | null;

function isStoryRefused(r: PayResult | VoucherBuyOutcome | void): r is StoryRefused {
  return typeof r === "object" && r !== null && "story_refused" in r;
}

/** One offer as the sheet and the Story page draw it: the deal, who may buy
 *  it, the card it pays with, and Pay. */
type Offer = {
  pay: string;
  get: string;
  /** "+10%". */
  bonus: string;
  /** "$20.00MX", or null without a catalog line. */
  bonusAmount: string | null;
  can: boolean;
  status: InfoStatus;
  /** This guest's own Story lock; the checklist wears it (MESITA-4299). */
  guestLock: GuestLock;
  storyGuest: StoryGuest;
  /** The one action that lifts a lock; `quiet` draws it as a text link. */
  unlock: { label: string; onClick: () => void; quiet?: boolean } | null;
  live: boolean;
  buying: boolean;
  payCards: PayCards | undefined;
  payCard: { label: string; last4: string } | null;
  canChange: boolean;
  onChangeCard: () => void;
  onRetryCards?: () => void;
  signedOut: boolean;
  /** The cards are still being read. */
  cardsPending: boolean;
  /** Cards were read and none is usable: Pay goes to Add a card. */
  needsCard: boolean;
  onPay: (mentionId?: string) => Promise<PayResult>;
  /** The host's offer_sheet_opened (MESITA-4375): called once a sheet's
   *  cards are known, with whether a saved card is ready. */
  onOpened: () => void;
};

/** Everything the Offers page and the Story page share: the rules, the
 *  cards, and how one product is bought. */
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
  // The host's check, bound once so the Story look keeps one loop.
  const onCheckStory = actions?.onCheckStory;
  const checkStory = useCallback(
    (opts: { poll: boolean }): Promise<StoryCheckAnswer> => onCheckStory ? onCheckStory(opts) : Promise.resolve({ kind: "failed" }),
    [onCheckStory],
  );

  const offer = (p: Product): Offer => {
    const line = catalog[p.key];
    const pay = priceValue(p, line, currency);
    const can = rules.buyable(p.key);
    const lock = rules.guestLock(p.key);
    // Too few followers: the count is the last sync's, so the guest can read it again.
    const unlock = lock === "instagram" && actions?.onLinkInstagram
      ? { label: "Link Instagram", onClick: actions.onLinkInstagram }
      : lock === "followers" && actions?.onLinkInstagram
        ? { label: "Grew your account? Sync Instagram", onClick: actions.onLinkInstagram, quiet: true }
        : null;
    const bonusAmount = line ? pesos(line.bonus_cents, currency) : null;
    return {
      pay,
      get: creditValue(p, line, currency),
      bonus: `+${p.bonus.replace(/ bonus$/, "")}`,
      bonusAmount,
      can,
      status: offerStatus(p.key, can, lock, rules.unavailable[p.key]),
      guestLock: can ? null : lock,
      storyGuest: {
        linked: actions?.guest ? actions.guest.instagramLinked : null,
        followers: actions?.guest?.instagramFollowers ?? null,
        handle: actions?.guest?.instagramHandle ?? null,
      },
      unlock,
      live,
      buying,
      payCards,
      payCard,
      canChange: usableCards.length > 1,
      onChangeCard: nextCard,
      onRetryCards: actions?.onRetryPayCards,
      signedOut,
      cardsPending: payCards !== undefined && payCards.state !== "ready",
      needsCard: payCards?.state === "ready" && payCard === null,
      onOpened: () => actions?.onOfferOpened?.(p.key, payCard !== null),
      onPay: async (mentionId?: string): Promise<PayResult> => {
        if (!live) return null;
        // No card yet: the Add a card page, which brings the guest back to
        // this offer (MESITA-4230, D4).
        if (!signedOut && readyCards !== null && payCard === null && actions?.onAddPayCard) {
          actions.onAddPayCard(p.key);
          return null;
        }
        // One unit, nothing else in the basket: a Story is paid alone and
        // names the story the check found (MESITA-4296).
        const out = await actions?.onBuyVoucher?.(
          [{ voucher: p.key, qty: 1 }],
          signedOut ? null : payCard?.id ?? null,
          mentionId ? { mentionId } : undefined,
        );
        if (isStoryRefused(out)) return out;
        if (out !== "paid" && out !== "processing") return null;
        // Story's bonus waits 3 hours from payment (MESITA-4296).
        const wait = line ? line.available_after_sec : p.key === "voucher_story" ? 3 * 3600 : null;
        const readyAt = wait !== null ? new Date(Date.now() + wait * 1000).toISOString() : null;
        return { outcome: out, pay, bonus: bonusAmount ? whole(bonusAmount) : null, readyAt };
      },
    };
  };
  return { loading, ...rules, catalog, currency, offer, checkStory };
}

/** OFFER EVENTS BASELINE (MESITA-4375): one offer_sheet_opened per opening,
 *  sent once the cards are read (or known absent), so `saved_card` is true
 *  only when a usable card was ready. The measuring ships before Apple Pay /
 *  Google Pay so the funnel has a before. */
function useOfferOpened(offer: Offer) {
  const sent = useRef(false);
  const { cardsPending, onOpened } = offer;
  useEffect(() => {
    if (sent.current || cardsPending) return;
    sent.current = true;
    onOpened();
  }, [cardsPending, onOpened]);
}

/** The card the offer pays with, Change, a failed read's Retry, and the
 *  no-card note (MESITA-4230, D4). */
function CardLine({ offer }: { offer: Offer }) {
  return (
    <>
      {offer.payCard && !offer.signedOut ? (
        <p className="flex items-center justify-between text-[15px]" data-pay-card-line>
          <span className="text-foreground truncate font-medium">
            {offer.payCard.label} •••• {offer.payCard.last4}
          </span>
          {offer.canChange ? (
            <button
              type="button"
              disabled={offer.buying}
              onClick={offer.onChangeCard}
              className="text-foreground min-h-9 shrink-0 font-semibold underline underline-offset-2 disabled:opacity-50"
            >
              Change
            </button>
          ) : null}
        </p>
      ) : null}
      {offer.payCards?.state === "error" ? (
        <p className="flex items-center justify-between text-[15px]" role="alert">
          <span className="text-foreground">Couldn&apos;t load your cards</span>
          <button type="button" onClick={offer.onRetryCards} className="text-foreground min-h-9 shrink-0 font-semibold underline underline-offset-2">
            Retry
          </button>
        </p>
      ) : null}
      {offer.needsCard && !offer.signedOut ? (
        <p className="text-muted-foreground text-center text-sm" data-offer-add-card-note>
          You&apos;ll add a card, then come right back here.
        </p>
      ) : null}
    </>
  );
}

const PRIMARY = "bg-foreground text-paper disabled:bg-muted disabled:text-muted-foreground flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold tabular-nums hover:opacity-90";
const QUIET = "text-muted-foreground min-h-11 self-center px-3 text-sm font-semibold underline underline-offset-2";

/** The Story check, from the host (MESITA-4296). */
type StoryHost = {
  check: (opts: { poll: boolean }) => Promise<StoryCheckAnswer>;
  simulate: (() => Promise<string | null>) | null;
  /** Test mode: the waiter's approval, emulated (MESITA-4307). */
  simulateApproval: (() => Promise<string | null>) | null;
  /** The guest's Instagram username, on the Found card. */
  guestHandle: string | null;
  testMode: boolean;
  /** The host's Instagram page: link it, or sync it after making it public. */
  onInstagram: (() => void) | null;
  /** The Story QR for the waiter (MESITA-4304). */
  renderQr: ((url: string) => ReactNode) | null;
};

/** OPEN INSTAGRAM (MESITA-4296): the story camera by deep link; when the page
 *  is still showing 1.5 s later the app did not open, so instagram.com opens
 *  instead. A failed deep link is silent. */
function openInstagram(): void {
  if (typeof window === "undefined") return;
  let left = false;
  const onHide = () => {
    if (document.visibilityState === "hidden") left = true;
  };
  document.addEventListener("visibilitychange", onHide);
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    if (!left && document.visibilityState !== "hidden") window.open("https://instagram.com", "_blank", "noopener,noreferrer");
  }, 1_500);
  try {
    window.location.href = "instagram://story-camera";
  } catch {
    // silent: the fallback above opens the web
  }
}

/** The names to type in the story, copied on a tap (44px tall, MESITA-4303). */
function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1_500);
          })
          .catch(() => {});
      }}
      className="bg-muted text-foreground inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold"
      aria-label={`Copy ${text}`}
      data-story-copy
    >
      {copied ? "Copied" : text}
      <Copy className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
    </button>
  );
}

/** The Found card: the story's thumbnail, the guest's @handle, how long ago.
 *  An image that fails to load falls back to the Instagram mark. */
function FoundCard({ mention, handle }: { mention: { media_url: string | null; media_kind: "image" | "video"; mentioned_at: string }; handle: string | null }) {
  const [broken, setBroken] = useState(false);
  const thumb = mention.media_url && mention.media_kind === "image" && !broken ? mention.media_url : null;
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#E9FBF1] p-3" data-story-found>
      <span className="bg-muted flex h-20 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg" aria-hidden>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- the story's own media URL
          <img src={thumb} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <Instagram className="h-6 w-6" />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 text-base font-bold text-[#00A85A]">
          <CircleCheck className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
          Found it
        </span>
        <span className="text-foreground truncate text-sm font-semibold">
          {handle ? `@${handle}` : "Your story"} · {postedAgo(mention.mentioned_at)}
        </span>
        <span className="text-muted-foreground text-sm leading-snug">Keep it up until you&apos;ve paid and 3 h after.</span>
      </span>
    </div>
  );
}

/** THE WAITER STEP (MESITA-4304): while the waiter has to see the story, the
 *  QR leads (at least 220 px) with a link for a phone without a camera; once
 *  approved, one green line and Pay. */
function WaiterBox({ review, renderQr }: { review: StoryReview; renderQr: ((url: string) => ReactNode) | null }) {
  if (review.state === "approved") {
    return (
      <Box data-story-review="approved">
        <p className="flex items-center gap-2 text-base font-bold text-[#00A85A]">
          <CircleCheck className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
          Approved by the waiter. You can pay now.
        </p>
      </Box>
    );
  }
  return (
    <Box title="Show this to your waiter" data-story-review="waiting">
      <div className="flex flex-col items-center gap-2 text-center" aria-live="polite">
        {review.url && renderQr ? <div className="rounded-2xl bg-white p-3" data-story-qr>{renderQr(review.url)}</div> : null}
        <p className="text-foreground text-[15px] leading-snug font-semibold">They scan it, check your story and approve it with the waiter code.</p>
        <p className="text-muted-foreground text-sm leading-snug">Pay turns on here by itself once it&apos;s approved.</p>
        {review.url ? (
          <a href={review.url} target="_blank" rel="noreferrer" className="text-muted-foreground min-h-9 text-sm underline underline-offset-2">
            Open the waiter&apos;s link
          </a>
        ) : null}
      </div>
    </Box>
  );
}

/** "2 h 14 min" until `iso`, whole minutes, or null once it has passed. */
function leftUntil(iso: string, now: number): string | null {
  const at = Date.parse(iso);
  if (!Number.isFinite(at) || at <= now) return null;
  const min = Math.ceil((at - now) / 60_000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** THE STORY PAGE'S FRAME (MESITA-4303, Pato: "definitely with own subpage,
 *  not modal weird view"; D5): the boxes scroll on the grey page, the one
 *  action is pinned under them on a white bar, clear of the phone's edge. */
function StoryFrame({ children, bar }: { children: ReactNode; bar: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-story-page>
      <div className="scrollbar-thin-dark bg-background flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-4 pb-6">{children}</div>
      <div className="bg-card border-border flex shrink-0 flex-col gap-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" data-story-bar>
        {bar}
      </div>
    </div>
  );
}

/** PAID (D4): the money is the guest's now, and a live countdown says until
 *  when the story must stay up; Done goes back to Offers. */
function StoryPaid({ receipt, placeName, onDone }: { receipt: Receipt; placeName: string; onDone: () => void }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const every = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, []);
  const paid = receipt.outcome === "paid";
  const left = receipt.readyAt && now !== null ? leftUntil(receipt.readyAt, now) : null;
  const bonus = receipt.bonus ? `+${receipt.bonus} bonus` : "bonus";
  return (
    <StoryFrame
      bar={
        <button type="button" onClick={onDone} autoFocus className={PRIMARY}>
          Done
        </button>
      }
    >
      <Box data-offer-receipt={receipt.outcome}>
        <p className="text-foreground flex items-center gap-2 text-xl font-bold tabular-nums" role="status">
          <CircleCheck className="h-7 w-7 shrink-0 text-[#00A85A]" strokeWidth={2.25} aria-hidden />
          {paid ? `${whole(receipt.pay)} is yours` : "Your bank is confirming"}
        </p>
        <p className="text-muted-foreground mt-1 text-[15px] leading-snug">
          {paid ? `Ready to spend now at ${placeName}.` : "The credit shows here once it's through. You won't be charged twice."}
        </p>
      </Box>
      {paid ? (
        <Box title="Your bonus" data-story-countdown="">
          <p className="text-foreground text-[17px] leading-snug font-bold tabular-nums">
            {receipt.readyAt ? `Don't delete your story until ${readyClock(receipt.readyAt)}` : "Don't delete your story for 3 hours"}
          </p>
          <p className="text-muted-foreground mt-1 text-[15px] leading-snug tabular-nums" aria-live="polite">
            {left ? `${left} left. Then your ${bonus} lands by itself.` : `Then your ${bonus} lands by itself.`}
          </p>
        </Box>
      ) : null}
    </StoryFrame>
  );
}

/** THE STORY PAGE (MESITA-4303; the sheet's StoryFlow since MESITA-4296):
 *  boxes in order (the deal, who can get it, how it works, good to know) and
 *  the pinned bar. On open the check runs once with its gate: a gate shows
 *  the checklist and its one action; otherwise the guest posts, the page
 *  looks for the story (every poll.every_ms for poll.for_ms, again on focus),
 *  and a found story turns the bar into the card and Pay. Paid, the page
 *  stays as the countdown (D4). Already bought here: a box and Wallet (D6). */
function StoryFlow({
  host,
  offer,
  placeName,
  placeHandle,
  onDone,
  onWallet,
}: {
  host: StoryHost;
  offer: Offer;
  placeName: string;
  placeHandle: string | null;
  onDone: () => void;
  onWallet: () => void;
}) {
  const [answer, setAnswer] = useState<StoryCheckAnswer | null>(null);
  const [gate, setGate] = useState<StoryGateReason | null>(null);
  const [looking, setLooking] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [handle, setHandle] = useState<string | null>(placeHandle);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  useOfferOpened(offer);
  const poll = useRef<StoryPoll | null>(null);
  const check = host.check;

  useEffect(() => {
    let gone = false;
    const loop = createStoryPoll({
      check: () => check({ poll: true }),
      onAnswer: (a) => {
        if (a.kind !== "failed") setHandle(a.placeHandle);
        // A failed poll keeps what is on screen (never reads as no_story).
        if (a.kind === "failed") return;
        setAnswer(a);
      },
      onLooking: setLooking,
    });
    poll.current = loop;
    // The first check runs the gate; the look after it skips it.
    void check({ poll: false })
      .catch((): StoryCheckAnswer => ({ kind: "failed" }))
      .then((a) => {
        if (gone) return;
        if (a.kind === "missing" && isStoryGateReason(a.reason)) {
          setGate(a.reason);
          setHandle(a.placeHandle);
          setAnswer(a);
          return;
        }
        if (a.kind !== "failed") setHandle(a.placeHandle);
        setAnswer(a.kind === "failed" ? { kind: "missing", reason: "no_story", placeHandle: null, poll: STORY_POLL_DEFAULT } : a);
        // An approved story is payable; a found one waits for the waiter.
        if (a.kind === "found" && a.review.state === "approved") return;
        loop.start(a.kind === "failed" ? STORY_POLL_DEFAULT : a.poll);
      });
    // Back from Instagram: look again, one loop, debounced.
    const wake = () => {
      if (document.visibilityState === "visible") loop.restart();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      gone = true;
      loop.close();
      poll.current = null;
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [check]);

  const view = storySheetView(answer, looking, gate);
  const mention = view.step === "found" ? view.mention : null;
  // MESITA-4304: Pay only once a waiter of this place approved the story.
  const review = view.step === "found" ? view.review : null;
  const approved = review?.state === "approved";

  // The look stops once the story is approved; a wake or tap then does nothing.
  useEffect(() => {
    if (approved) poll.current?.found();
  }, [approved]);

  const lookNow = () => {
    setRefusal(null);
    poll.current?.start();
  };

  const simulate = async () => {
    if (!host.simulate) return;
    setSimulating(true);
    const line = await host.simulate().catch(() => "Couldn't tag the place. Try again.");
    setSimulating(false);
    if (line) setRefusal(line);
    else lookNow();
  };

  // MESITA-4307: the test band stands in for the waiter.
  const simulateApproval = async () => {
    if (!host.simulateApproval) return;
    setSimulating(true);
    const line = await host.simulateApproval().catch(() => "Couldn't simulate the approval. Try again.");
    setSimulating(false);
    if (line) setRefusal(line);
    else lookNow();
  };

  const press = async () => {
    if (mention && !approved) return;
    if (!mention) {
      // To Instagram's story camera; the look runs again on the way back.
      openInstagram();
      lookNow();
      return;
    }
    const r = await offer.onPay(mention.id);
    if (isStoryRefused(r)) {
      // Nothing was charged: back to the check with the server's line.
      setRefusal(r.story_refused);
      setAnswer({ kind: "missing", reason: "no_story", placeHandle: handle, poll: STORY_POLL_DEFAULT });
      poll.current?.start();
      return;
    }
    if (r) setReceipt(r);
  };

  if (receipt) return <StoryPaid receipt={receipt} placeName={placeName} onDone={onDone} />;

  const deal = <OfferBox pay={offer.pay} get={offer.get} bonus={offer.bonus} />;
  const amount = whole(offer.pay);
  const bonusText = offer.bonusAmount ? whole(offer.bonusAmount) : null;
  const good = <GoodToKnow productKey="voucher_story" />;

  // ALREADY BOUGHT HERE (D6): no lock; the Story and its countdown are in Wallet.
  if (view.step === "gate" && view.reason === "already_bought") {
    return (
      <StoryFrame
        bar={
          <button type="button" onClick={onWallet} className={PRIMARY} data-story-wallet>
            See it in Wallet
          </button>
        }
      >
        {deal}
        <Box data-story-gate="already_bought">
          <p className="text-foreground text-[17px] leading-snug font-bold">You already have a Story here.</p>
          <p className="text-muted-foreground mt-1 text-[15px] leading-snug">One per visit. Its bonus and countdown are in Wallet.</p>
        </Box>
        {good}
      </StoryFrame>
    );
  }

  if (view.step === "gate") {
    const failing: StoryFail =
      view.reason === "needs_instagram" ? "instagram" : view.reason === "private_account" ? "private" : view.reason === "few_followers" ? "followers" : null;
    return (
      <StoryFrame
        bar={
          <>
            {view.action && host.onInstagram ? (
              <button type="button" onClick={host.onInstagram} className={PRIMARY} data-offer-action>
                {view.action === "sync_instagram" ? "Sync Instagram" : "Link Instagram"}
              </button>
            ) : (
              <button type="button" onClick={onDone} className={PRIMARY} data-story-other-offers>
                See other offers
              </button>
            )}
            {/* Too few followers: the count is the last sync's, so a guest who grew can read it again. */}
            {view.reason === "few_followers" && host.onInstagram ? (
              <button type="button" onClick={host.onInstagram} className={QUIET} data-offer-action="quiet">
                Grew your account? Sync Instagram
              </button>
            ) : null}
          </>
        }
      >
        {deal}
        <div data-story-gate={view.reason} className="contents">
          <NeedBox needs={storyNeeds(offer.storyGuest, failing, false)} />
          {/* The amber line only when the checklist does not already say it. */}
          {failing === "instagram" || failing === "followers" ? null : (
            <p className="flex shrink-0 items-start gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 text-amber-900">
              <Lock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <span className="text-[15px] leading-snug font-semibold">{view.text}</span>
            </p>
          )}
        </div>
        <Box title="How it works" className="opacity-50">
          <StepList steps={storySteps(amount, bonusText, storyPostLine(handle), null)} />
        </Box>
        {good}
      </StoryFrame>
    );
  }

  const lookLine =
    view.step === "checking" || looking
      ? "Looking for your story. It shows up here by itself."
      : view.step === "post"
        ? view.note
        : null;
  const button = offer.signedOut
    ? "Sign in to buy"
    : !mention
      ? "Open Instagram"
      : !approved
        ? "Waiting for the waiter"
        : offer.buying
        ? "Paying…"
        : offer.needsCard
          ? "Add a card to pay"
          : `Pay ${amount}`;

  return (
    <StoryFrame
      bar={
        <>
          {refusal ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[15px] leading-snug font-semibold text-amber-900" role="alert" data-story-refusal>
              {refusal}
            </p>
          ) : null}
          {approved ? <CardLine offer={offer} /> : null}
          <button
            type="button"
            onClick={() => void press()}
            disabled={!offer.live || offer.buying || (mention !== null && (!approved || offer.cardsPending))}
            className={PRIMARY}
            data-voucher-buy="voucher_story"
            data-story-primary={mention ? (approved ? "pay" : "waiter") : "post"}
          >
            {approved && offer.needsCard && !offer.signedOut ? <CreditCard className="h-5 w-5" strokeWidth={2.25} aria-hidden /> : null}
            {mention ? null : <Instagram className="h-5 w-5" aria-hidden />}
            {button}
          </button>
          {mention ? null : (
            <p className="text-muted-foreground flex min-h-5 flex-wrap items-center justify-center gap-x-2 text-center text-sm" aria-live="polite" data-story-look>
              <span>{lookLine}</span>
              {view.step === "post" && !looking ? (
                <button type="button" onClick={lookNow} className="text-foreground min-h-9 font-semibold underline underline-offset-2" data-story-check>
                  Check again
                </button>
              ) : null}
            </p>
          )}
        </>
      }
    >
      {deal}
      <NeedBox needs={storyNeeds(offer.storyGuest, null, view.step === "post" || view.step === "found")} />
      <Box title="How it works" data-story-steps="">
        <StepList
          steps={storySteps(
            amount,
            bonusText,
            <>
              Tag us both in it.
              <span className="mt-1.5 block">
                <CopyChip text={storyTags(handle)} />
              </span>
            </>,
            mention === null ? "post" : approved ? "pay" : "waiter",
          )}
        />
        {mention ? <FoundCard mention={mention} handle={host.guestHandle} /> : null}
      </Box>
      {review ? <WaiterBox review={review} renderQr={host.renderQr} /> : null}
      {host.testMode && host.simulateApproval && review?.state === "waiting" ? (
        <div className="border-border flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed p-2" data-story-emulator>
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-900 uppercase">Test</span>
          <button
            type="button"
            disabled={simulating}
            onClick={() => void simulateApproval()}
            className="text-muted-foreground min-h-9 px-2 text-sm font-semibold underline disabled:opacity-60"
            data-story-simulate="approve"
          >
            {simulating ? "Approving…" : "Simulate the waiter's approval"}
          </button>
        </div>
      ) : null}
      {good}
      {host.testMode && host.simulate && !mention ? (
        <div className="border-border flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed p-2" data-story-emulator>
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-900 uppercase">Test</span>
          <button
            type="button"
            disabled={simulating}
            onClick={() => void simulate()}
            className="text-muted-foreground min-h-9 px-2 text-sm font-semibold underline disabled:opacity-60"
            data-story-simulate="post"
          >
            {/* MESITA-4310: no screenshot; the test story just tags @mesita and the place. */}
            {simulating ? "Tagging…" : handle ? `Tag @${handle} (test story)` : "Tag the place (test story)"}
          </button>
        </div>
      ) : null}
    </StoryFrame>
  );
}

/** The deal: You pay $X · You get $Y with the bonus named, in its own box. */
function OfferBox({ pay, get, bonus }: { pay: string; get: string; bonus: string }) {
  return (
    <div className={cn(CARD, "flex shrink-0 items-end justify-between gap-3 px-4 py-3")} data-offer-deal>
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
  );
}

/** THE PAY SHEET (Pato, 2026-11-17, MESITA-4224: "simply click a button and
 *  the offer you select opens a modal and in that modal you click to pay"):
 *  a bottom sheet in the app card (Pay in thumb reach). IN BOXES ON GREY
 *  since MESITA-4303 (D2): the header, then the deal, How it works, Good to
 *  know, and the card with Pay, each its own white box, in that order. A
 *  locked offer shows its reason where Pay goes. Paid, it turns into a
 *  receipt. Escape or a tap outside closes it; focus returns to the row that
 *  opened it. Story opens its own page when the host has one (MESITA-4303);
 *  here it is only a preview (admin) or a host without the page.
 *  decision: a sheet in the package, against apps/web-consumer › Overlays
 *  (MESITA-4094, pages not sheets): Pato's live call in the design review. */
function PaySheet({
  product,
  placeName,
  placeHandle,
  offer,
  onClose,
}: {
  product: Product;
  placeName: string;
  /** The place's Instagram username, named in Story's steps (MESITA-4291). */
  placeHandle: string | null;
  offer: Offer;
  onClose: () => void;
}) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  useOfferOpened(offer);
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
  const host = typeof document !== "undefined" ? document.getElementById("mesita-app-card") : null;
  const { can, signedOut, buying, needsCard } = offer;
  const button = signedOut ? "Sign in to buy" : buying ? "Paying…" : needsCard ? "Add a card to pay" : `Pay ${whole(offer.pay)}`;
  // ONE CONFIRM BEFORE A CHARGE (MESITA-4357, Pato: "when you click pay,
  // please add a confirmation … this just feels too aggressive"): a tap that
  // would charge the saved card first asks in the pay box; signing in and
  // adding a card charge nothing, so they go straight through.
  const [asking, setAsking] = useState(false);
  const charges = !signedOut && !needsCard;
  const press = async () => {
    if (charges && !asking) {
      setAsking(true);
      return;
    }
    setAsking(false);
    const r = await offer.onPay();
    if (r && !isStoryRefused(r)) setReceipt(r);
  };
  const isStory = product.key === "voucher_story";
  const amount = whole(offer.pay);
  const bonusText = offer.bonusAmount ? whole(offer.bonusAmount) : null;
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
        className="bg-background flex max-h-[92%] w-full flex-col gap-3 overflow-y-auto rounded-t-3xl px-4 pt-2 pb-5 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="bg-border mx-auto h-1 w-10 shrink-0 rounded-full" aria-hidden />
        <div className="flex shrink-0 items-center gap-3 px-1">
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
          <Box data-offer-receipt={receipt.outcome}>
            <div className="flex flex-col gap-4" role="status">
              <div className="flex items-center gap-3">
                <CircleCheck className="h-8 w-8 shrink-0 text-[#00A85A]" strokeWidth={2.25} aria-hidden />
                <p className="text-foreground text-xl font-bold tabular-nums">
                  {receipt.outcome === "paid" ? `Paid ${whole(receipt.pay)}` : "Your bank is confirming"}
                </p>
              </div>
              <ul className="text-foreground flex flex-col gap-2 text-[15px] leading-snug">
                {receipt.outcome === "paid" ? (
                  <>
                    <li className="tabular-nums">{`${whole(receipt.pay)} is ready to spend now.`}</li>
                    <li className="tabular-nums">
                      {receipt.bonus ? `The ${receipt.bonus} bonus` : "The bonus"}
                      {receipt.readyAt ? ` is ready at ${readyClock(receipt.readyAt)}.` : " is ready 3 hours later."}
                    </li>
                  </>
                ) : (
                  <li>The credit shows here once it&apos;s through. You won&apos;t be charged twice.</li>
                )}
              </ul>
              <button type="button" onClick={onClose} autoFocus className={PRIMARY}>
                Done
              </button>
            </div>
          </Box>
        ) : (
          <>
            <OfferBox pay={offer.pay} get={offer.get} bonus={offer.bonus} />
            {isStory ? (
              <>
                <NeedBox needs={storyNeeds(offer.storyGuest, offer.guestLock === "instagram" ? "instagram" : offer.guestLock === "followers" ? "followers" : null, false)} />
                <Box title="How it works" className={can ? undefined : "opacity-50"}>
                  <StepList steps={storySteps(amount, bonusText, storyPostLine(placeHandle), null)} />
                </Box>
              </>
            ) : (
              <Box title="How it works" data-offer-steps-box="">
                <StepList steps={sheetSteps(amount, bonusText, signedOut ? null : offer.payCard)} />
              </Box>
            )}
            <GoodToKnow productKey={product.key} />
            <Box data-offer-pay-box="">
              {can ? (
                asking && !buying ? (
                  <div className="flex flex-col gap-3" data-offer-confirm="">
                    <p className="text-foreground text-[17px] leading-snug font-semibold tabular-nums">
                      {offer.payCard ? `Pay ${amount} with ${offer.payCard}?` : `Pay ${amount}?`}
                    </p>
                    <button
                      type="button"
                      onClick={() => void press()}
                      disabled={!offer.live || offer.cardsPending}
                      className={PRIMARY}
                      data-voucher-buy={product.key}
                      autoFocus
                    >
                      {`Yes, pay ${amount}`}
                    </button>
                    <button type="button" onClick={() => setAsking(false)} className={QUIET}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <CardLine offer={offer} />
                    <button
                      type="button"
                      onClick={() => void press()}
                      disabled={!offer.live || buying || offer.cardsPending}
                      className={PRIMARY}
                      data-voucher-ask={product.key}
                    >
                      {needsCard && !signedOut ? <CreditCard className="h-5 w-5" strokeWidth={2.25} aria-hidden /> : null}
                      {button}
                    </button>
                  </div>
                )
              ) : (
                // LOCKED (MESITA-4224, D4): the reason where Pay goes, and the
                // one action that unlocks it when there is one.
                <div className="flex flex-col gap-3">
                  {/* The amber line only when the checklist does not already say it. */}
                  {isStory && offer.guestLock ? null : (
                    <p className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-amber-900" data-offer-status="locked">
                      <Lock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                      <span className="text-[15px] leading-snug font-semibold">{offer.status.text}</span>
                    </p>
                  )}
                  {offer.unlock ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        offer.unlock?.onClick();
                      }}
                      className={offer.unlock.quiet ? QUIET : PRIMARY}
                      data-offer-action={offer.unlock.quiet ? "quiet" : ""}
                    >
                      {offer.unlock.label}
                    </button>
                  ) : null}
                </div>
              )}
            </Box>
          </>
        )}
      </div>
    </div>,
    host ?? document.body,
  );
}

/** THE STORY OFFER ON ITS OWN PAGE (MESITA-4303): the host's
 *  /place/<id>/story draws this under its own header. Without the host's
 *  check (admin's preview) there is no page: Story stays a sheet. */
export function StoryOfferPage({
  place,
  actions,
  onDone,
  onWallet,
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
  /** Back to the Offers page. */
  onDone: () => void;
  /** This place's credit in Wallet, where a bought Story's countdown lives. */
  onWallet: () => void;
}) {
  const onLoad = actions?.onLoadVouchers;
  useEffect(() => {
    onLoad?.();
  }, [onLoad]);
  const co = useOfferCheckout(place, actions);
  const story = SPECIAL.find((p) => p.key === "voucher_story");
  if (!story) return null;
  const offer = co.offer(story);
  const host: StoryHost = {
    check: co.checkStory,
    simulate: actions?.onSimulateStory ?? null,
    simulateApproval: actions?.onSimulateApproval ?? null,
    guestHandle: actions?.guest?.instagramHandle ?? null,
    testMode: place.money?.test_mode === true,
    onInstagram: actions?.onLinkInstagram ?? null,
    renderQr: actions?.renderStoryQr ?? null,
  };
  return (
    <StoryFlow
      host={host}
      offer={offer}
      placeName={place.name}
      placeHandle={instagramHandle(place.channels?.instagram_url)}
      onDone={onDone}
      onWallet={onWallet}
    />
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

  const co = useOfferCheckout(place, actions);
  const { loading, dim, guestLock, buyable, unavailable, catalog, currency } = co;
  // STORY IS A PAGE (MESITA-4303): the host opens /place/<id>/story; without
  // one (admin's preview) Story stays a sheet like the rest.
  const openStory = actions?.onOpenStory;

  // A TAP OPENS THE SHEET (MESITA-4224): no tick, no foot Pay. A Home chip's
  // voucher (MESITA-4207) opens its sheet at once, or Story's page.
  const asked = actions?.askedVoucher;
  const askedKey = asked && (MONEY_VOUCHER_KEYS as readonly string[]).includes(asked) ? (asked as MoneyVoucherKey) : null;
  const [open, setOpen] = useState<MoneyVoucherKey | null>(() => (askedKey === "voucher_story" && openStory ? null : askedKey));
  const opener = useRef<HTMLButtonElement | null>(null);
  const close = useCallback(() => {
    setOpen(null);
    opener.current?.focus();
  }, []);
  // A Home chip asked for Story: its page, after a tick (no navigation in render).
  useEffect(() => {
    if (askedKey !== "voucher_story" || !openStory) return;
    let gone = false;
    void Promise.resolve().then(() => {
      if (!gone) openStory();
    });
    return () => {
      gone = true;
    };
  }, [askedKey, openStory]);

  const products = listedProducts();

  const sheetProduct = open && !loading ? products.find((p) => p.key === open) ?? null : null;
  const sheet: ReactNode = sheetProduct ? (
    <PaySheet
      product={sheetProduct}
      placeName={place.name}
      placeHandle={instagramHandle(place.channels?.instagram_url)}
      offer={co.offer(sheetProduct)}
      onClose={close}
    />
  ) : null;

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
                        if (p.key === "voucher_story" && openStory) openStory();
                        else setOpen(p.key);
                      }}
                      aria-haspopup={p.key === "voucher_story" && openStory ? undefined : "dialog"}
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
                        <span className="text-foreground truncate text-base font-semibold">{p.short}</span>
                        {/* IN INK (Pato, 2026-11-17, MESITA-4227: "the pay and
                            get must be clearer, it's too transparent"): Pay
                            medium, Get semibold, only the dot grey. */}
                        <span className="text-foreground truncate text-[15px] font-medium tabular-nums">
                          Pay {whole(pay)} <span className="text-muted-foreground">·</span>{" "}
                          <span className="font-semibold">Get {whole(get)}</span>
                        </span>
                      </span>
                      {/* THE BONUS IS THE HERO, AT THE RIGHT IN A BLACK BOX
                          (Pato, 2026-11-17, MESITA-4230: "the bonus amount must
                          be at the right in a box and must be clearer. its the
                          most important ... in a black box"; MESITA-4227: "must
                          mention bonus"): "+30%" big over "BONUS". The chevron
                          went so the deal keeps its width on a 390px phone;
                          the box is the row's tap cue. */}
                      <span
                        className="bg-foreground text-paper flex w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-xl py-1.5 tabular-nums"
                        aria-hidden
                        data-offer-bonus
                      >
                        <span className="text-lg leading-none font-extrabold tracking-tight">{bonus}</span>
                        <span className="mt-1 text-[10px] leading-none font-bold tracking-wider uppercase opacity-80">Bonus</span>
                      </span>
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
