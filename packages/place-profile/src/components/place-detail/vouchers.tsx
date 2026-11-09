"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { BadgePercent, Sparkles } from "lucide-react";

import type { PlaceActions, RewardsSection } from "../../actions";
import { inertButtonProps } from "../../actions";
import { cn, firstInitial } from "../../lib/format";
import {
  PLACE_BONE_CLASS,
  PLACE_BUTTON_CLASS,
  PLACE_META_CLASS,
  PLACE_PILL_CLASS,
} from "../../lib/ui";
import { moneyState, type MoneyVoucherKey, type VoucherReason } from "../../money-state";
import type { PlaceDetail, VoucherCatalogLine } from "../../place-detail";
import { MesitaPayMark } from "../PlaceMarks";
import { SizedImg } from "../SizedPhoto";

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

// SMALL, MEDIUM AND BIG VOUCHER SINCE MESITA-3452 (Pato: "rename the other
// packages to small voucher, medium voucher, big voucher ... welcome
// voucher"); Standard, Standard Medium, Standard Large before.
// THE STANDARD THREE ARE NAMED, NOT PRICED (Pato, MESITA-3362: "the name
// of the thing should be Welcome, Story, VIP, Standard, Medium Standard,
// Large Standard"): the deal line carries the amounts.
const STANDARD: Product[] = [
  { key: "voucher_200", name: "Small", line: "Pay MX$200, get MX$220.", limit: "As many as you like.", bonus: "10% bonus", short: "Small", brief: "As many as you like" },
  { key: "voucher_1000", name: "Medium", line: "Pay MX$1,000, get MX$1,200.", limit: "As many as you like.", bonus: "20% bonus", short: "Medium", brief: "As many as you like" },
  { key: "voucher_5000", name: "Big", line: "Pay MX$5,000, get MX$6,500.", limit: "As many as you like.", bonus: "30% bonus", short: "Big", brief: "As many as you like" },
];

const SPECIAL: Product[] = [
  { key: "voucher_welcome", name: "Welcome", line: "Pay MX$100, get MX$130.", limit: "One, on your first visit.", bonus: "30% bonus", short: "Welcome", brief: "First visit only" },
  { key: "voucher_story", name: "Story", line: "Pay MX$100, get MX$130.", limit: "One per day.", bonus: "30% bonus", short: "Story", brief: "Post a story · 1/day" },
  { key: "voucher_vip", name: "VIP", line: "Pay MX$100, get MX$130.", when: "VIP guests only.", limit: "One per day.", bonus: "30% bonus", short: "VIP", brief: "VIP guests · 1/day" },
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

/** A section title on the one-screen Offers page: 16px (MESITA-3452). */
const OFFERS_TITLE_CLASS = "text-foreground font-sans text-base leading-tight font-semibold";
/** The bonus: the hero tile's green pill, ink text (MESITA-3446). */
const BONUS_PILL = cn(PLACE_PILL_CLASS, "shrink-0 self-start bg-green-400 px-1.5 py-0 text-[10px] font-bold text-neutral-950");
/** The small action on an offer (MESITA-3454, Pato: "make the pay buttons
 *  smaller"): 28px, 11px words. */
const SMALL_ACTION = "h-7 min-h-7 rounded-md text-[11px]";

/** A card: one hairline edge, white, rounded. */
const CARD = "border-border bg-card rounded-2xl border";

/** One voucher, a third of the row (MESITA-3451). DESIGN C SINCE MESITA-3454
 *  (Pato: "make the payment and prepayment offers better"): the name small,
 *  the credit it buys big, "for MX$X" under it, the "+N% bonus" pill, then a
 *  28px Buy or the tag. A special voucher sits on ink with a sparkle and a
 *  green Buy, so the specials read as special. */
function OfferCard({
  name,
  bonus,
  pay,
  get,
  label,
  faded,
  special,
  action,
}: {
  name: string;
  bonus: string;
  pay: string;
  get: string;
  label: string;
  faded: boolean;
  special: boolean;
  action: ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-2xl p-2.5",
        special ? "bg-neutral-950 text-white" : CARD,
        faded && "opacity-50",
      )}
      aria-label={label}
    >
      <span
        className={cn(
          "flex min-w-0 items-center gap-1 truncate text-[10px] font-semibold uppercase",
          special ? "text-green-400" : "text-muted-foreground",
        )}
      >
        {special ? <Sparkles className="h-3 w-3 shrink-0" aria-hidden /> : null}
        {name}
      </span>
      <span className="truncate text-lg leading-tight font-extrabold tabular-nums" aria-hidden>
        {get}
      </span>
      <span className={cn("truncate text-[11px] tabular-nums", special ? "text-white/60" : "text-muted-foreground")} aria-hidden>
        for {pay}
      </span>
      <span className={BONUS_PILL}>+{bonus}</span>
      <div className="mt-1">{action}</div>
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
  // ONE STRIP SINCE MESITA-3452 (Pato: "fit all in one screen"); a 1.7:1 card
  // before. SMALLER SINCE MESITA-3454 (Pato: "maybe the card make it small").
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-neutral-950 px-3 py-2 text-white" data-house-card data-place-credit>
      <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-white/30 bg-white/10">
        {place.photos.length > 0 ? (
          <SizedImg src={place.photos[0]} size="thumb" alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs font-semibold">
            {firstInitial(place.name)}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs text-white/60">
          Your House Card
          {place.money?.mesita_pay ? <MesitaPayMark className="h-4 w-4 shrink-0" /> : null}
        </span>
        <span className="block truncate text-[11px] leading-snug text-white/80">
          {pending > 0
            ? `+ ${pesos(pending, currency)} pending · ready within the hour`
            : available > 0
              ? "Spend it when you pay the bill here."
              : "No credit needed to pay. Credit adds a bonus."}
        </span>
      </span>
      <span className="shrink-0 text-base font-bold tabular-nums" aria-label={`Your credit here: ${pesos(available, currency)}`}>
        {pesos(available, currency)}
      </span>
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
  const specialRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focus === "payment") return;
    const el = focus === "special" ? specialRef.current : prepaymentRef.current;
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
  const row = (items: Product[], label: string, special = false) => (
    <ul className="grid grid-cols-3 gap-1.5" aria-label={label} data-voucher-catalog>
      {items.map((p) => {
        const line = catalog[p.key];
        const pay = priceValue(p, line, currency);
        const get = creditValue(p, line, currency);
        const deal = p.key === "voucher_story" ? `Pay ${pay} & post a story, Get ${get}` : `Pay ${pay}, Get ${get}`;
        const reason = unavailable[p.key];
        const can = !loading && buyable(p.key);
        const action = loading ? (
          <div className={cn(PLACE_BONE_CLASS, "h-7 w-full")} aria-hidden data-reward-loading />
        ) : can ? (
          <button
            type="button"
            {...inertButtonProps(live)}
            onClick={live ? () => actions?.onBuyVoucher?.(p.key) : undefined}
            disabled={buying}
            aria-label={`Buy the ${p.name} voucher, ${deal}`}
            className={cn(ACTION_BUTTON, SMALL_ACTION, "px-1", special && "bg-green-400 font-bold text-neutral-950")}
            data-voucher-buy={p.key}
          >
            {actions?.buyingVoucher === p.key ? "Opening…" : "Buy"}
          </button>
        ) : (
          <span className={cn("flex h-7 items-center justify-center text-center text-[10px] leading-tight font-semibold", special ? "text-white/60" : "text-muted-foreground")}>
            {tag(reason)}
          </span>
        );
        return (
          <OfferCard
            key={p.key}
            name={p.short}
            bonus={p.bonus}
            pay={pay}
            get={get}
            label={`${p.name} voucher, ${deal}. ${[p.when, loading || can ? p.limit : tag(reason)].filter(Boolean).join(" ")}`}
            faded={!loading && !can && dim}
            special={special}
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
    // ONE SCREEN SINCE MESITA-3452 (Pato: "fit all in one screen"): 16px
    // titles, no subtitles, 10px between blocks.
    <div className="bg-card -mx-4 -mt-4 flex flex-col gap-2.5 px-4 pt-3 pb-4" data-promos-page>
      {/* NO TEST NOTICE (MESITA-3454, Pato: "remove the test advice i don't
          care. for the moment"). Stripe's test mode still decides the charge. */}
      <section className="flex flex-col gap-2" aria-labelledby="rewards-payment" data-promos="payment">
        <h3 id="rewards-payment" className={OFFERS_TITLE_CLASS}>Payment Offers</h3>
        <div
          className={cn(CARD, "flex items-center gap-3 rounded-xl p-2.5", !loading && !cashback && dim && "opacity-50")}
          aria-label={`5% Cashback: pay the bill here by card, 5% comes back as credit. ${loading ? "" : cashbackTag}`}
          data-cashback
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-400 text-neutral-950" aria-hidden>
            <BadgePercent className="h-5 w-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col" aria-hidden>
            <span className="text-foreground text-sm leading-snug font-semibold">5% Cashback</span>
            <span className="text-muted-foreground text-xs leading-snug">
              {canPay || loading ? "Pay by card, 5% back as credit" : cashbackTag}
            </span>
          </span>
          {loading ? (
            <div className={cn(PLACE_BONE_CLASS, "h-7 w-16 shrink-0")} aria-hidden data-reward-loading />
          ) : canPay ? (
            <button
              type="button"
              onClick={actions?.onPay}
              aria-label="Pay the bill here with Mesita"
              className={cn(ACTION_BUTTON, SMALL_ACTION, "w-auto shrink-0 px-3")}
            >
              Pay bill
            </button>
          ) : null}
        </div>
      </section>
      <section ref={prepaymentRef} className="flex flex-col gap-2" aria-labelledby="rewards-prepayment" data-promos="prepayment">
        <h3 id="rewards-prepayment" className={OFFERS_TITLE_CLASS}>Prepayment Offers</h3>
        {row(STANDARD, "Prepayment offers")}
      </section>
      <section ref={specialRef} className="flex flex-col gap-2" aria-labelledby="rewards-special" data-promos="special">
        <h3 id="rewards-special" className={OFFERS_TITLE_CLASS}>Special Prepayment Offers</h3>
        {row(SPECIAL, "Special prepayment offers", true)}
        <p className={cn(PLACE_META_CLASS, "text-[11px] leading-snug")}>
          Welcome: first visit · Story: post a story, 1/day, ready at once · VIP: VIP guests, 1/day. Other credit is ready in an hour.
        </p>
      </section>
      {loading ? (
        <div className={cn(PLACE_BONE_CLASS, "h-11 w-full rounded-xl")} aria-hidden data-reward-loading />
      ) : (
        <HouseCard place={place} currency={currency} />
      )}
    </div>
  );
}
