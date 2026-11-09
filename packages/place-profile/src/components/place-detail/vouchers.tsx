"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { BadgePercent } from "lucide-react";

import type { PlaceActions, RewardsSection } from "../../actions";
import { inertButtonProps } from "../../actions";
import { cn, firstInitial } from "../../lib/format";
import {
  PLACE_BONE_CLASS,
  PLACE_BUTTON_CLASS,
  PLACE_META_CLASS,
  PLACE_PILL_CLASS,
  PLACE_SCREEN_TITLE_CLASS,
} from "../../lib/ui";
import { moneyState, type MoneyVoucherKey, type VoucherReason } from "../../money-state";
import type { PlaceDetail, VoucherCatalogLine } from "../../place-detail";
import { MesitaPayMark } from "../PlaceMarks";
import { SizedImg } from "../SizedPhoto";
import { TestBand } from "../TestBand";

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
// Promos", "Payment Promos", "5% Cashback"), over the screen's sentence
// case. THE STANDARD THREE SHARE ONE MARK AND ONE COLOUR, the
// wallet on emerald (MESITA-3326, Pato: "the standard deals/promos must
// have the same icon and the same color. the deals that have different
// colors are welcome and story VIP"); the specials keep their own. The
// cashback in Payment promos is the same kind of card, so the two boxes
// read as one module (Pato: "symmetry and modularity"). Under the title, one
// line says the credit is ready an hour after the purchase, Story's at
// once (the catalog's available_after_sec, MESITA-3302; Pato, MESITA-3323:
// "must be 1 hour before paying the bill ... All but the Instagram one").
// TWO CARDS, PROMOS (Pato, MESITA-3322: "call the section up Prepayments
// Deals: Bonus 10% or whatever. Payments Deals: Cashback"; MESITA-3323:
// "maybe Promos is the best"): "Prepayment promos" is the catalog,
// "Payment promos" is the standard 5% cashback, one row drawn the same way,
// its one line the plain fact (Pato: "write cashback ... clearer"). Nothing
// scrolls sideways.
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
// The cashback is the same card with one row and its Pay under it (Pato:
// "say go or pay ... maybe change button from side").

//
// TWO SECTIONS OF OFFERS (Pato, MESITA-3446: "list all the offers better ...
// Payment Offers: the cashback offer. Prepayment Offers: horizontal carrousel
// of vouchers"): Payment Offers is one card, the green % mark and "5%
// Cashback" over the plain fact, Pay bill under it. Prepayment Offers is the
// six vouchers as cards that swipe sideways (snap), specials first; each card
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

// THE STANDARD THREE ARE NAMED, NOT PRICED (Pato, MESITA-3362: "the name
// of the thing should be Welcome, Story, VIP, Standard, Medium Standard,
// Large Standard"): the deal line carries the amounts.
const STANDARD: Product[] = [
  { key: "voucher_200", name: "Standard", line: "Pay MX$200, get MX$220.", limit: "As many as you like.", bonus: "10% Bonus", short: "Standard", brief: "As many as you like" },
  { key: "voucher_1000", name: "Standard Medium", line: "Pay MX$1,000, get MX$1,200.", limit: "As many as you like.", bonus: "20% Bonus", short: "Medium", brief: "As many as you like" },
  { key: "voucher_5000", name: "Standard Large", line: "Pay MX$5,000, get MX$6,500.", limit: "As many as you like.", bonus: "30% Bonus", short: "Large", brief: "As many as you like" },
];

const SPECIAL: Product[] = [
  { key: "voucher_welcome", name: "Welcome", line: "Pay MX$100, get MX$130.", limit: "One, on your first visit.", bonus: "30% Bonus", short: "Welcome", brief: "First visit only" },
  { key: "voucher_story", name: "Story", line: "Pay MX$100, get MX$130.", limit: "One per day.", bonus: "30% Bonus", short: "Story", brief: "Post a story · 1/day" },
  { key: "voucher_vip", name: "VIP", line: "Pay MX$100, get MX$130.", when: "VIP guests only.", limit: "One per day.", bonus: "30% Bonus", short: "VIP", brief: "VIP guests · 1/day" },
];

/** "MX$1,200" from cents. Formatting only, never arithmetic. */
export function pesos(cents: number, currency: string): string {
  const code = currency.toUpperCase();
  const whole = cents % 100 === 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(cents / 100).replace(/^\$/, code === "MXN" ? "MX$" : "$");
  } catch {
    return `${(cents / 100).toFixed(whole ? 0 : 2)} ${code}`;
  }
}

/** The credit: the server's, else from the copy. */
function creditValue(product: Product, line: VoucherCatalogLine | undefined, currency: string): string {
  if (line) return pesos(line.credit_cents, currency);
  const m = /get (MX\$[\d,]+)/.exec(product.line);
  return m ? m[1] : product.name;
}
/** What a guest pays: the server's, else from the copy. */
function priceValue(product: Product, line: VoucherCatalogLine | undefined, currency: string): string {
  if (line) return pesos(line.price_cents, currency);
  const m = /Pay (MX\$[\d,]+)/.exec(product.line);
  return m ? m[1] : product.name;
}

/** One tag per state, objective: where it stands for this guest at this place. */
function tag(reason: VoucherReason | undefined): string {
  if (!reason) return "Available here";
  if (reason === "off" || reason === "needs_account") return "Not at this place yet";
  if (reason === "paused") return "Paused for a moment";
  if (reason === "used") return "You had yours here";
  return "Coming soon";
}

/** The full-width action under a card: 44px, ink on paper. */
const ACTION_BUTTON = cn(PLACE_BUTTON_CLASS, "bg-foreground text-paper w-full px-4 hover:opacity-90 disabled:opacity-60");

/** A Rewards section title: 18px, the screen title's size, on a tight line. */
const PROMOS_TITLE_CLASS = cn(PLACE_SCREEN_TITLE_CLASS, "leading-tight");
/** The bonus: the hero tile's green pill, ink text (MESITA-3446). */
const BONUS_PILL = cn(PLACE_PILL_CLASS, "shrink-0 bg-green-400 px-1.5 py-0.5 text-[11px] text-neutral-950");

/** A card: one hairline edge, white, rounded. */
const CARD = "border-border bg-card rounded-2xl border";

/** A section's head: the 18px title, an optional grey line under it. */
function SectionHead({ id, title, subtitle }: { id: string; title: string; subtitle?: string }) {
  return (
    <div className="min-w-0">
      <h3 id={id} className={PROMOS_TITLE_CLASS}>
        {title}
      </h3>
      {subtitle ? <p className={PLACE_META_CLASS}>{subtitle}</p> : null}
    </div>
  );
}

/** One voucher, a third of the row (MESITA-3451, Pato: "not carousel, all
 *  three in one row"): the name, its bonus pill, Pay over Get, the limit,
 *  then Buy or the tag. */
function OfferCard({
  name,
  bonus,
  pay,
  get,
  small,
  label,
  faded,
  action,
}: {
  name: string;
  bonus: string;
  pay: string;
  get: string;
  small: string;
  label: string;
  faded: boolean;
  action: ReactNode;
}) {
  return (
    <li className={cn(CARD, "flex min-w-0 flex-col gap-2 rounded-xl p-2.5", faded && "opacity-50")} aria-label={label}>
      <div className="flex flex-col items-start gap-1">
        <span className="text-muted-foreground w-full truncate text-[11px] font-semibold tracking-wide uppercase">{name}</span>
        <span className={BONUS_PILL}>{bonus}</span>
      </div>
      <div className="flex flex-col leading-tight tabular-nums" aria-hidden>
        <span className="text-muted-foreground text-[11px]">Pay</span>
        <span className="text-foreground text-sm font-semibold">{pay}</span>
        <span className="text-muted-foreground mt-0.5 text-[11px]">Get</span>
        <span className="text-base font-bold text-green-700">{get}</span>
      </div>
      <p className="text-muted-foreground flex-1 text-[11px] leading-snug">{small}</p>
      {action}
    </li>
  );
}

/** THE HOUSE CARD (Pato, MESITA-3448: "show a preview of the House Card for
 *  that place like how many credits you have"): the guest's credit at this
 *  place as a dark card, the place's photo and name, "House Card" and the
 *  Mesita Pay mark on top, the server's available balance big, its pending
 *  line under it. No credit reads MX$0 and that credit is optional (Pato,
 *  MESITA-3451: "you don't need to add credits to your House Card in order
 *  to pay, that must be clear"); it sits last on the page since then. The numbers are
 *  list-vouchers' balance; this file formats cents and never adds. */
function HouseCard({ place, currency }: { place: PlaceDetail; currency: string }) {
  const balance = place.money?.balance ?? null;
  const available = balance?.available_cents ?? 0;
  const pending = balance?.pending_cents ?? 0;
  return (
    <div
      className="relative flex aspect-[1.7] flex-col justify-between overflow-hidden rounded-2xl bg-neutral-950 p-5 text-white"
      data-house-card
    >
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-green-400/20" aria-hidden />
      <div className="relative flex items-center gap-3">
        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/30 bg-white/10">
          {place.photos.length > 0 ? (
            <SizedImg src={place.photos[0]} size="thumb" alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-semibold">
              {firstInitial(place.name)}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{place.name}</span>
          <span className="block text-xs text-white/60">House Card</span>
        </span>
        {place.money?.mesita_pay ? <MesitaPayMark className="h-6 w-6 shrink-0" /> : null}
      </div>
      <div className="relative" data-place-credit>
        <p className="text-xs text-white/60">Your credit here</p>
        <p className="text-4xl leading-tight font-bold tabular-nums">{pesos(available, currency)}</p>
        <p className="mt-1 text-xs text-white/70">
          {pending > 0
            ? `+ ${pesos(pending, currency)} pending · ready within the hour`
            : available > 0
              ? "Spend it when you pay the bill here."
              : "You can pay the bill without credit. Credit is optional, for the bonus."}
        </p>
      </div>
    </div>
  );
}


/** The Rewards page (MESITA-3412: the host's sheet off Prepay and Pay; it
 *  was the fourth tab). `focus` scrolls its scroller to that section once, on
 *  open: Pay's section is first, so only Prepay moves. */
export function VouchersPane({
  place,
  actions,
  focus = "payment",
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
  focus?: RewardsSection;
}) {
  const onLoad = actions?.onLoadVouchers;
  useEffect(() => {
    onLoad?.();
  }, [onLoad]);
  const prepaymentRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focus !== "prepayment") return;
    const el = prepaymentRef.current;
    // The nearest scroller only: scrollIntoView would also move the app
    // card behind the sheet, whose overflow is hidden but still scrollable.
    let box = el?.parentElement ?? null;
    while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    if (!el || !box) return;
    box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top;
  }, [focus]);

  const money = place.money;
  // The host is still asking list-vouchers and the place read carried no
  // offer: draw the rows and a bone, never a guess (MESITA-3388).
  const loading = actions?.vouchersLoading === true && !money;
  // A Google-only card or an older read has no money: every switch reads off.
  // Only `unavailable` is valid from this local call: the read strips
  // `pay_cards`, so its cashback and mesita_pay are not the server's. The
  // cashback row reads the server's word, `money.cashback` (MESITA-3408).
  const state = moneyState(
    {
      cashback: money?.cashback === true,
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
  const catalog = money?.catalog ?? {};
  const currency = money?.currency ?? "mxn";
  // IN TEST MODE NOTHING IS GREYED (Pato, MESITA-3334); live mode dims a row
  // not for sale.
  const dim = money?.test_mode !== true;
  const cashback = money?.cashback === true;
  const cashbackTag = cashback ? "Available here" : "Not at this place yet";
  // Pay shows where the 5% comes back, or in test mode (MESITA-3397): a live
  // Pay at a place without cashback promised 5% that never comes.
  const canPay = Boolean(actions?.onPay) && (cashback || !dim);

  // Buyable: for sale, or in test mode any row the server has not used up or
  // paused (Pato, MESITA-3342: "must be buyable or whatever").
  const buyable = (k: MoneyVoucherKey) => {
    const reason = unavailable[k];
    return reason === undefined || (!dim && reason !== "used" && reason !== "paused");
  };
  const live = Boolean(actions?.onBuyVoucher);
  const buying = actions?.buyingVoucher != null;

  /** One row of three vouchers (MESITA-3451). */
  const row = (items: Product[], label: string) => (
    <ul className="grid grid-cols-3 gap-2" aria-label={label} data-voucher-catalog>
      {items.map((p) => {
        const line = catalog[p.key];
        const pay = priceValue(p, line, currency);
        const get = creditValue(p, line, currency);
        const deal = p.key === "voucher_story" ? `Pay ${pay} & post a story, Get ${get}` : `Pay ${pay}, Get ${get}`;
        const reason = unavailable[p.key];
        const can = !loading && buyable(p.key);
        const small = loading || can ? p.brief : tag(reason);
        const action = loading ? (
          <div className={cn(PLACE_BONE_CLASS, "h-9 w-full")} aria-hidden data-reward-loading />
        ) : can ? (
          <button
            type="button"
            {...inertButtonProps(live)}
            onClick={live ? () => actions?.onBuyVoucher?.(p.key) : undefined}
            disabled={buying}
            aria-label={`Buy the ${p.name} voucher, ${deal}`}
            className={cn(ACTION_BUTTON, "h-9 min-h-9 px-1 text-xs")}
            data-voucher-buy={p.key}
          >
            {actions?.buyingVoucher === p.key ? "Opening…" : "Buy"}
          </button>
        ) : null;
        return (
          <OfferCard
            key={p.key}
            name={p.short}
            bonus={p.bonus}
            pay={pay}
            get={get}
            small={small}
            label={`${p.name} voucher, ${deal}. ${[p.when, loading || can ? p.limit : tag(reason)].filter(Boolean).join(" ")}`}
            faded={!loading && !can && dim}
            action={action}
          />
        );
      })}
    </ul>
  );

  return (
    // A WHITE PAGE (MESITA-3366). THREE ROWS SINCE MESITA-3451 (Pato:
    // "Payment Offers all in one row; Prepayment Offers ... all three in one
    // row; Special Prepayment Offers ... all three in one row"), the House
    // Card last ("maybe move the House Card to the bottom").
    <div className="bg-card -mx-4 -mt-4 flex flex-col pb-4" data-promos-page>
      {money?.test_mode ? (
        <div className="px-4 pt-4">
          <TestBand />
        </div>
      ) : null}
      <section className="flex flex-col gap-3 px-4 pt-5" aria-labelledby="rewards-payment" data-promos="payment">
        <SectionHead id="rewards-payment" title="Payment Offers" />
        <div
          className={cn(CARD, "flex items-center gap-3 p-3", !loading && !cashback && dim && "opacity-50")}
          aria-label={`5% Cashback: pay the bill here by card, 5% comes back as credit. ${loading ? "" : cashbackTag}`}
          data-cashback
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-400 text-neutral-950" aria-hidden>
            <BadgePercent className="h-5 w-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5" aria-hidden>
            <span className="text-foreground text-sm leading-snug font-semibold">5% Cashback</span>
            <span className="text-muted-foreground text-xs leading-snug">
              {canPay || loading ? "Pay by card, 5% back as credit" : cashbackTag}
            </span>
          </span>
          {loading ? (
            <div className={cn(PLACE_BONE_CLASS, "h-9 w-20 shrink-0")} aria-hidden data-reward-loading />
          ) : canPay ? (
            <button
              type="button"
              onClick={actions?.onPay}
              aria-label="Pay the bill here with Mesita"
              className={cn(ACTION_BUTTON, "h-9 min-h-9 w-auto shrink-0 px-4 text-xs")}
            >
              Pay bill
            </button>
          ) : null}
        </div>
      </section>
      <section ref={prepaymentRef} className="flex flex-col gap-3 px-4 pt-6" aria-labelledby="rewards-prepayment" data-promos="prepayment">
        <SectionHead id="rewards-prepayment" title="Prepayment Offers" subtitle="Buy credit, get a bonus. Ready in an hour." />
        {row(STANDARD, "Prepayment offers")}
      </section>
      <section className="flex flex-col gap-3 px-4 pt-6" aria-labelledby="rewards-special" data-promos="special">
        <SectionHead id="rewards-special" title="Special Prepayment Offers" subtitle="Bigger bonuses, limited. Story's credit is ready at once." />
        {row(SPECIAL, "Special prepayment offers")}
      </section>
      <section className="flex flex-col gap-3 px-4 pt-6" aria-labelledby="rewards-house" data-promos="house">
        <SectionHead id="rewards-house" title="Your House Card" />
        {loading ? (
          <div className={cn(PLACE_BONE_CLASS, "aspect-[1.7] w-full rounded-2xl")} aria-hidden data-reward-loading />
        ) : (
          <HouseCard place={place} currency={currency} />
        )}
      </section>
    </div>
  );
}
