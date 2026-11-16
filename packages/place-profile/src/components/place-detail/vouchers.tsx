"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Banknote, Check, ChevronRight, CircleCheck, Crown, Info, Lock, PartyPopper, Smartphone, Ticket, type LucideIcon } from "lucide-react";
import { isCardExpired, type PayCards } from "../../pay-cards";
import { Instagram } from "../brand-icons";

import type { PlaceActions, VoucherBasketItem } from "../../actions";
import { cn } from "../../lib/format";
import {
  PLACE_META_CLASS,
} from "../../lib/ui";
import { moneyState, type MoneyVoucherKey, NOT_YET_SELLABLE, STORY_MIN_FOLLOWERS, type VoucherReason } from "../../money-state";
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
// line says the credit is ready an hour after the purchase, Story's at
// once (the catalog's available_after_sec, MESITA-3302; Pato, MESITA-3323:
// "must be 1 hour before paying the bill ... All but the Instagram one").
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
  { key: "voucher_200", name: "Small", line: "Pay $200.00MX, get $220.00MX.", limit: "As many as you like.", bonus: "10% bonus", short: "Small Bonus", brief: "As many as you like" },
  { key: "voucher_1000", name: "Medium", line: "Pay $1,000.00MX, get $1,200.00MX.", limit: "As many as you like.", bonus: "20% bonus", short: "Medium Bonus", brief: "As many as you like" },
  { key: "voucher_5000", name: "Big", line: "Pay $5,000.00MX, get $6,500.00MX.", limit: "As many as you like.", bonus: "30% bonus", short: "Big Bonus", brief: "As many as you like" },
];

const SPECIAL: Product[] = [
  { key: "voucher_welcome", name: "Welcome", line: "Pay $100.00MX, get $200.00MX.", limit: "One per place.", bonus: "100% bonus", short: "Welcome Bonus", brief: "One per place" },
  { key: "voucher_story", name: "Story", line: "Pay $100.00MX, get $130.00MX.", limit: "One per day.", bonus: "30% bonus", short: "Story Bonus", brief: "Post a story · 1/day" },
  { key: "voucher_vip", name: "VIP", line: "Pay $100.00MX, get $200.00MX.", when: "VIP guests only.", limit: "One per day.", bonus: "100% bonus", short: "VIP Bonus", brief: "VIP guests · 1/day" },
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
  const green: Face = { card: "bg-green-200 text-neutral-950", ...LIGHT, Mark: Ticket };
  return {
    voucher_200: green,
    voucher_1000: green,
    voucher_5000: green,
    // Every offer green (MESITA-4181); the marks still tell them apart.
    voucher_welcome: { ...green, Mark: PartyPopper },
    voucher_story: { ...green, Mark: Instagram },
    voucher_vip: { ...green, Mark: Crown },
  };
})();

/** A row's fact (MESITA-3863). It wraps like any text, but "in 1 hr" stays
 *  whole, so a narrow row never strands "hr" on a line of its own. */
function Fact({ text }: { text: string }) {
  return <span className="tabular-nums">{text.replace(/ in (\d+) hr\b/, " in\u00a0$1\u00a0hr")}</span>;
}

function SectionTitle({ id, title }: { id: string; title: string }) {
  return (
    <h3 id={id} className={OFFERS_TITLE_CLASS}>
      {title}
    </h3>
  );
}

/** AN (i) ON EACH OFFER (MESITA-3493, Pato: "add one i button for each
 *  offer"), opening a SMALL MODAL, NOT A DROPDOWN (MESITA-3488): a centred
 *  card over a dimmed page with the offer's own explanation and Got it; a tap
 *  outside or Escape closes it. It opens in a portal on the body, above the
 *  sheet and out of any dimmed row; it sits inside a row's label, so every click
 *  in it is stopped and its default prevented: reading never picks the row. */
/** The (i)'s status strip and its one action (MESITA-3502, Pato: "below show
 *  the state ... and maybe also an action like request upgrade besides the
 *  Got it button"). */
type InfoStatus = { ok: boolean; text: string };
type InfoAction = { label: string; onClick: () => void };

function InfoButton({
  title,
  text,
  status,
  action,
}: {
  title: string;
  text: string[];
  status?: InfoStatus;
  action?: InfoAction;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  // ON THE PHONE, NOT THE PAGE (MESITA-3524, Pato: "modal must be ON THE
  // PHONE emulator screen, not on the terminals"): the popup portals into the
  // app card when there is one (the consumer app's #mesita-app-card), else the
  // body (admin's preview).
  const host = typeof document !== "undefined" ? document.getElementById("mesita-app-card") : null;
  const stop = (e: { preventDefault(): void; stopPropagation(): void }) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <span className="inline-flex" onClick={stop}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`How ${title} works`}
        className="text-muted-foreground hover:text-foreground relative flex h-6 w-6 items-center justify-center rounded-full after:absolute after:-inset-2"
        data-offer-info
      >
        <Info className="h-5 w-5" aria-hidden />
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <span
          className={cn(host ? "absolute" : "fixed", "inset-0 z-[135] flex items-center justify-center bg-black/40 p-6")}
          onClick={() => setOpen(false)}
          data-offers-note
        >
          <span
            role="dialog"
            aria-modal="true"
            aria-label={`How ${title} works`}
            className="bg-card flex max-h-[85vh] w-full max-w-sm cursor-auto flex-col gap-3 rounded-2xl p-5 text-left shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-foreground text-base font-semibold">{title}</span>
            {/* SHORT PARAGRAPHS (MESITA-3497, Pato: "use multiple paragraphs"),
                SMALLER (MESITA-3852, Pato: "text smaller"; "keep the pages super
                clean"): the descriptions live here, never on the page, in 14px. */}
            <span className="text-muted-foreground flex flex-col gap-2 overflow-y-auto text-sm leading-snug font-normal">
              {text.map((t) => (
                <span key={t} className="block">
                  {t}
                </span>
              ))}
            </span>
            {status ? (
              <span
                className={cn(
                  "mt-1 flex items-start gap-2.5 rounded-xl px-3 py-2.5",
                  status.ok ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900",
                )}
                data-offer-status={status.ok ? "ok" : "locked"}
              >
                {status.ok ? (
                  <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                ) : (
                  <Lock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                )}
                <span className="flex flex-col">
                  <span className="text-[11px] font-semibold tracking-wide uppercase opacity-70">Your status</span>
                  <span className="text-sm leading-snug font-semibold">{status.text}</span>
                </span>
              </span>
            ) : null}
            <span className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                autoFocus
                className={cn(
                  "h-11 rounded-xl text-sm font-semibold hover:opacity-90",
                  action ? "bg-muted text-foreground w-28 shrink-0" : "bg-foreground text-paper flex-1",
                )}
              >
                Got it
              </button>
              {action ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    action.onClick();
                  }}
                  className="bg-foreground text-paper h-11 flex-1 rounded-xl text-sm font-semibold hover:opacity-90"
                  data-offer-action
                >
                  {action.label}
                </button>
              ) : null}
            </span>
          </span>
        </span>,
        host ?? document.body,
      )
      : null}
    </span>
  );
}

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

function readyIn(key: MoneyVoucherKey): string {
  if (key === "voucher_story") return "after story";
  // Every voucher but Story waits an hour (MESITA-3323); Welcome and VIP
  // said "instantly" while the catalog held them an hour (fixed MESITA-3835,
  // Pato: "don't land instantly ... they should actually land 1hr after
  // payment").
  return "in 1 hr";
}

/** The lines every prepayment (i) ends with (MESITA-3498, Pato: "credits are
 *  transferable to friends too"; "you don't need to prepay all the bill"). */
const CREDIT_FACTS = [
  // MESITA-3505, Pato: "you can fund your wallet with multiple vouchers and
  // then pay the bill with it ... everywhere, that is super important".
  "Buy as many vouchers as you want: their credits add up in one wallet, and you can pay one bill with all of them.",
  "Spend your credits on your bill here whenever you want, in the Mesita app. You don't have to cover the whole bill with them: pay part with credits and the rest with App Payments or directly to the place.",
  "Credits only work at this place. You can send them to a friend.",
];

/** What each offer's (i) says, one short paragraph per idea (MESITA-3492,
 *  split by MESITA-3497, rewritten clearer by MESITA-3498), with the row's
 *  own Pay and Get. */
function offerInfo(key: MoneyVoucherKey, pay: string, get: string, bonus: string, facts: string[]): string[] {
  const deal = `Pay ${pay}, get ${get} in credits at this place. That's ${bonus} extra.`
;
  switch (key) {
    case "voucher_200":
    case "voucher_1000":
    case "voucher_5000":
      return [deal, "Your credits are ready 1 hour after you buy.", "Buy as many as you like.", ...facts];
    case "voucher_welcome":
      return [
        deal,
        "Your credits are ready 1 hour after you buy.",
        "One per place. Every other place on Mesita has its own Welcome for you.",
        ...facts,
      ];
    case "voucher_story":
      return [
        deal,
        // TWO STEPS AND A FLOOR (MESITA-3506, Pato: "first buy it, then ...
        // activate it by posting an instagram story tagging the place";
        // "only available for users that have more than 1000 followers").
        "Only for guests with more than 1,000 Instagram followers.",
        "It takes two steps. 1. Buy it here. 2. Activate it: post an Instagram story at the place, tag the place, and show the story to the staff.",
        "One per visit.",
        ...facts,
      ];
    case "voucher_vip":
      return [
        deal,
        "Only for Mesita's VIP Class. VIP guests are added by hand: models, modeling agencies, creators and others places want to see. Not VIP? You can't buy this one.",
        "Your credits are ready 1 hour after you buy. One per visit.",
        ...facts,
      ];
  }
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
    const reason = unavailable[k];
    return reason === undefined || (!dim && reason !== "used" && reason !== "paused" && reason !== "needs_visit");
  };
  return { unavailable, dim, guestLock, buyable };
}

/** One of the six vouchers as a row elsewhere (the House Card, MESITA-3822):
 *  the Offers page's own words, colour and rules, formatted, never added. */
export type VoucherOffer = {
  key: MoneyVoucherKey;
  /** "Small Bonus" … "VIP Bonus". */
  title: string;
  /** The chip's tint and ink (the voucher's face). */
  chipClass: string;
  /** "+10%". */
  bonus: string;
  pay: string;
  get: string;
  /** "in 1 hr" or "after story". */
  ready: string;
  /** This guest can buy it now. */
  buyable: boolean;
  /** Not buyable and drawn dimmed (live mode). */
  dimmed: boolean;
  /** Why not, in one short line, when it is not buyable. */
  why: string | null;
};

/** The Offers page's voucher list: ONE GROUP, "Prepaid Vouchers" (Pato,
 *  MESITA-4173: "Prepaid Vouchers ... Welcome, VIP"); Special Vouchers and
 *  Bonus Vouchers from MESITA-4154. The host still opens it by
 *  `?rewards=prepayment` or `?rewards=special`. */
const GROUPS: { id: "prepayment"; title: string; keys: ReadonlySet<MoneyVoucherKey> }[] = [
  {
    id: "prepayment",
    title: "Prepaid Vouchers",
    keys: new Set(["voucher_welcome", "voucher_story", "voucher_vip", "voucher_200", "voucher_1000", "voucher_5000"]),
  },
];

/** The vouchers a guest is shown: every product but the parked ones
 *  (MESITA-3831: Story is off sale and
 *  off the page, money-state's NOT_YET_SELLABLE). */
function listedProducts(): Product[] {
  // Welcome, VIP, Small, Medium, Big (MESITA-4154: the specials lead);
  // Welcome · sizes · VIP from MESITA-4056.
  return [...SPECIAL, ...STANDARD].filter((p) => !NOT_YET_SELLABLE[p.key]);
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
  // offer: draw the rows and a bone, never a guess (MESITA-3388).
  const loading = actions?.vouchersLoading === true && !money;
  const { unavailable, dim, guestLock, buyable } = offerRules(money, actions?.guest);
  const catalog = money?.catalog ?? {};
  const currency = money?.currency ?? "mxn";
  const facts = CREDIT_FACTS;
  const live = Boolean(actions?.onBuyVoucher);
  const buying = actions?.buyingVoucher != null;
  // THE CHECKOUT IS THE PAGE (MESITA-4065, Pato: "you simply select the item
  // and select the payment method and click the button to pay"): the saved
  // cards sit under the offers, the one purple Pay charges the selected card.
  const payCards: PayCards | undefined = actions?.payCards;
  const readyCards = payCards?.state === "ready" ? payCards.cards : null;
  const payCardId = actions?.payCardId ?? null;
  const payCard = readyCards?.find((c) => c.id === payCardId && !isCardExpired(c)) ?? null;
  // NO "PAY WITH" BOX (MESITA-4150, Pato: "remove this fucking box of
  // payments bottom in prepayments"): the card is named in the foot, and
  // Change steps to the next usable card.
  const usableCards = readyCards?.filter((c) => !isCardExpired(c)) ?? [];
  const nextCard = () => {
    if (usableCards.length < 2) return;
    const at = usableCards.findIndex((c) => c.id === payCard?.id);
    actions?.onSelectPayCard?.(usableCards[(at + 1) % usableCards.length].id);
  };
  // SELECT, THEN BUY (MESITA-3487, Pato: "you select then you click Buy").
  // ONE VOUCHER PER PAYMENT (Pato, 2026-11-16, MESITA-4186: "Prepay must not
  // be stocked"): ticking a row unticks the others, no quantity. Several in
  // one basket with 1..5 of Small, Medium and Big from MESITA-3841; the
  // server still takes a basket, the page sends one line.
  const [picked, setPicked] = useState<MoneyVoucherKey | null>(null);
  const pick = (key: MoneyVoucherKey) => setPicked(key);
  const toggle = (key: MoneyVoucherKey) => setPicked((k) => (k === key ? null : key));

  // SIZES FIRST (MESITA-3484, Pato: "Small Bonus, Mid Bonus, Big Bonus /
  // Welcome Bonus, Story Bonus, VIP Bonus").
  const products = listedProducts();
  const anyBuyable = !loading && products.some((p) => buyable(p.key));
  const chosen = loading ? [] : products.filter((p) => picked === p.key && buyable(p.key)).map((p) => ({ product: p, qty: 1 }));
  const items: VoucherBasketItem[] = chosen.map((c) => ({ voucher: c.product.key, qty: c.qty }));
  const units = chosen.reduce((n, c) => n + c.qty, 0);
  // The button's sums: the server's catalog lines, never a guess. A read
  // without them names the one voucher as before.
  const lines = chosen.map((c) => ({ ...c, line: catalog[c.product.key] }));
  const summed = lines.length > 0 && lines.every((l) => l.line)
    ? {
      pay: pesos(lines.reduce((sum, l) => sum + l.line!.price_cents * l.qty, 0), currency),
      get: pesos(lines.reduce((sum, l) => sum + l.line!.credit_cents * l.qty, 0), currency),
    }
    : lines.length === 1 && units === 1
      ? { pay: priceValue(lines[0].product, undefined, currency), get: creditValue(lines[0].product, undefined, currency) }
      : null;
  // SHORTER ROWS, SYMMETRIC NAMES (MESITA-3490, Pato: "make the items a bit
  // shorter").
  // SHORTER STILL (Pato, 2026-11-13, MESITA-3829: "make this smaller
  // somehow, i mean, shorter, its using tooo much space"): 36px chips, 6px
  // row padding, the fact on one line.
  // 12px row padding and gaps since MESITA-4186 (the tick box at the left).
  const ROW = "flex w-full items-center gap-3 px-3.5 py-3 text-left";
  // A BIT SMALLER (MESITA-3768, Pato: "make this a bit smaller, the text, just
  // a bit"): one small step each, titles 15px, fact lines 13px, chips 18px.
  // ONE RUN OF TEXT (Pato, 2026-11-14, MESITA-3863: "Name of thing in Bold.
  // and then description starting in the same line. then the i in other
  // part ... vertically save space"; "enable two lines if the page is not
  // wide enough"): the bold name (15px), then the fact in grey (14px; MESITA-3872,
  // Pato: "the not bold letters not that small, or in general is too small"), wrapping
  // when narrow (two lines on a 390px phone, so 8px gaps and 12px row
  // padding); the (i) in its own column at the right; chips 28px tall.
  // Wide enough for "+100%" (MESITA-4186: it overflowed the 48px chip).
  const CHIP = "flex h-8 min-w-15 shrink-0 items-center justify-center rounded-lg px-2 text-[15px] font-extrabold tracking-tight tabular-nums";
  const LINE = "text-muted-foreground min-w-0 flex-1 text-sm leading-snug";
  const NAME = "text-foreground text-[15px] font-semibold";
  const ICON = "mr-1 inline h-4 w-4 align-[-0.15em]";
  // Where a row has no tick box or lock, so every (i) sits in one column.
  const SLOT = <span className="h-6 w-6 shrink-0" aria-hidden />;

  // The foot's one button (MESITA-4065). Nothing picked: "Select an offer".
  // Cards still loading or failed: Pay waits (never a flash of "Add a card").
  // No usable card: "Add a card to pay" opens the host's card sheet. Else Pay.
  const payText = summed
    ? `Pay ${noMx(summed.pay)}, Get ${noMx(summed.get)} ${readyIn(chosen[0]?.product.key ?? "voucher_200")}`
    : `Pay for ${units} vouchers`;
  const needsCard = readyCards !== null && payCard === null;
  const footText = items.length === 0 ? "Select an offer" : buying ? "Paying…" : needsCard ? "Add a card to pay" : payText;
  const footLabel = items.length === 0
    ? "Select an offer to buy"
    : needsCard
      ? "Add a card to pay"
      : units === 1
        ? `Pay for the ${chosen[0].product.name} voucher`
        : `Pay for ${units} vouchers`;
  const cardsPending = payCards !== undefined && payCards.state !== "ready";
  const footDisabled = items.length === 0 || !live || buying || cardsPending;
  const footAction = items.length > 0 && live
    ? () => {
      if (needsCard) actions?.onAddPayCard?.();
      else actions?.onBuyVoucher?.(items, payCard?.id ?? null);
    }
    : undefined;

  return (
    // A LIST (MESITA-3486, Pato: "make the things as a list, not as boxes"):
    // one card of rows, each led by its big number. A prepayment row you can
    // buy carries a selector at its right; the one Buy sits at the foot
    // (MESITA-3487). No Pay bill here.
    // ON THE GREY PAGE (MESITA-4196, Pato over the Reserve page: "Fix the
    // prepaid vouchers"): the body is the page background, the vouchers one
    // white panel on it, as the Reserve page's sections. White from MESITA-3486.
    <div className="-mx-4 -mt-4 flex flex-1 shrink-0 flex-col gap-3 px-4 pt-4 pb-4" data-promos-page>
      {/* TWO GROUPS (Pato, 2026-11-16, MESITA-4173): Prepaid Vouchers
          (Welcome · VIP · Small · Medium · Big), then Credits Back. Special
          and Bonus Vouchers in MESITA-4154; one "Prepayments"
          list before. The vouchers share one basket and the one Pay at the foot. */}
      {GROUPS.map((g) => {
        const list = products.filter((p) => g.keys.has(p.key));
        if (list.length === 0) return null;
        return (
      // ONE PANEL (MESITA-4196): the Reserve page's Panel, its heading inside
      // at the top, the rows under a hairline.
      <section key={g.id} className={cn(CARD, "shrink-0 overflow-hidden")} aria-labelledby={`rewards-${g.id}`} data-promos={g.id}>
        <div className="px-4 pt-4 pb-3">
          <SectionTitle id={`rewards-${g.id}`} title={g.title} />
        </div>
        <ul className="border-border divide-border divide-y border-t" data-voucher-catalog>
          {list.map((p) => {
            const line = catalog[p.key];
            const pay = priceValue(p, line, currency);
            const get = creditValue(p, line, currency);
            const deal = `Pay ${pay}, Get ${get}`;
            const reason = unavailable[p.key];
            const can = !loading && buyable(p.key);
            const face = FACES[p.key];
            const Mark = face.Mark;
            const opening = buying && picked === p.key;
            const on = can && picked === p.key;
            const lock = guestLock(p.key);
            // TICK LEFT, BONUS RIGHT (Pato, 2026-11-16, MESITA-4186: "Select at
            // the left, Bonus amount ... at the right"; design review pick A):
            // the name with its mark and the (i) on line one, the deal on line
            // two, whole amounts without ".00MX". The chip led the row and the
            // tick box ended it from MESITA-3486.
            const middle = (
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={cn(NAME, "truncate")} aria-hidden>
                    {Mark ? <Mark className={ICON} strokeWidth={2.25} /> : null}
                    {p.short}
                  </span>
                  <InfoButton
                    title={p.short}
                    text={offerInfo(p.key, pay, get, p.bonus.replace(/ bonus$/, ""), facts)}
                    status={loading ? undefined : offerStatus(p.key, can, lock, reason)}
                    action={
                      loading
                        ? undefined
                        : can
                          ? { label: "Choose this offer", onClick: () => pick(p.key) }
                          : lock === "vip" && actions?.onJoinVip
                            ? { label: "Request VIP", onClick: actions.onJoinVip }
                            : lock === "instagram" && actions?.onLinkInstagram
                              ? { label: "Link Instagram", onClick: actions.onLinkInstagram }
                              : undefined
                    }
                  />
                </span>
                <span className={LINE} aria-hidden>
                  <Fact
                    text={opening
                      ? "Opening…"
                      : `Pay ${whole(pay)} · Get ${whole(get)} ${readyIn(p.key)}`}
                  />
                </span>
              </span>
            );
            const chip = (
              <span className={cn(CHIP, face.card)} aria-hidden>
                +{p.bonus.replace(/ bonus$/, "")}
              </span>
            );
            return (
              <li key={p.key} data-voucher={p.key} className={cn(!loading && !can && dim && "opacity-50")}>
                {can ? (
                  <label className={cn(ROW, "hover:bg-muted/50 cursor-pointer")}>
                    <input
                      type="checkbox"
                      name="voucher"
                      value={p.key}
                      checked={on}
                      onChange={() => toggle(p.key)}
                      aria-label={`Choose the ${p.name} voucher, ${deal}`}
                      className="sr-only"
                    />
                    {/* A ROUND TICK (MESITA-4196): one voucher per payment since
                        MESITA-4186, so the Reserve page's round choice mark; at the left. */}
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                        on ? "border-foreground bg-foreground text-paper" : "border-border",
                      )}
                      aria-hidden
                    >
                      {on ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
                    </span>
                    {middle}
                    {chip}
                  </label>
                ) : (
                  <div className={ROW} aria-label={`${p.name} voucher, ${deal}. ${loading ? "" : tag(reason)}`}>
                    {/* LOCKED, NOT A SELECTOR (MESITA-3495, Pato: "if not available show a
                        locked icon instead of the circle"), where the tick box sits. */}
                    {loading ? SLOT : (
                      <span className="text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden data-voucher-locked>
                        <Lock className="h-5 w-5" strokeWidth={2.25} />
                      </span>
                    )}
                    {middle}
                    {chip}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
        );
      })}
      {/* ONE PAY AT THE FOOT (MESITA-3487; MESITA-4065): the card it charges
          is named above it (MESITA-4150: the only place it is named), so nobody
          pays with a card they cannot see;
          purple, Stripe's colour (Pato: "maybe the stripe button purple"). */}
      <div className="bg-card border-border sticky bottom-0 -mx-4 mt-auto -mb-4 border-t px-4 py-3" data-promos="checkout">
        {payCard && items.length > 0 ? (
          <p className="text-muted-foreground mb-2 flex items-center justify-between text-sm" data-pay-card-line>
            <span className="text-foreground truncate font-medium">
              {payCard.label} •••• {payCard.last4}
            </span>
            {usableCards.length > 1 ? (
              <button
                type="button"
                disabled={buying}
                className="text-foreground shrink-0 font-semibold underline underline-offset-2 disabled:opacity-50"
                onClick={nextCard}
              >
                Change
              </button>
            ) : null}
          </p>
        ) : null}
        {payCards?.state === "error" && items.length > 0 ? (
          <p className="text-muted-foreground mb-2 flex items-center justify-between text-sm" role="alert">
            <span className="text-foreground">Couldn&apos;t load your cards</span>
            <button
              type="button"
              className="text-foreground shrink-0 font-semibold underline underline-offset-2"
              onClick={actions?.onRetryPayCards}
            >
              Retry
            </button>
          </p>
        ) : null}
        <button
          type="button"
          onClick={footAction}
          disabled={footDisabled}
          aria-label={footLabel}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-[#635BFF] text-base font-semibold text-white hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground"
          data-voucher-buy={items.length > 0 ? items.map((i) => (i.qty > 1 ? `${i.voucher}x${i.qty}` : i.voucher)).join(",") : undefined}
        >
          {footText}
        </button>
      </div>
    </div>
  );
}

