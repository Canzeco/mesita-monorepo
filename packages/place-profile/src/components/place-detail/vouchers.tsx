"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BadgePercent, Banknote, Crown, Info, PartyPopper, Wallet, type LucideIcon } from "lucide-react";
import { Instagram } from "../brand-icons";

import type { PlaceActions, RewardsSection } from "../../actions";
import { cn, firstInitial } from "../../lib/format";
import {
  PLACE_META_CLASS,
} from "../../lib/ui";
import { moneyState, type MoneyVoucherKey, type VoucherReason } from "../../money-state";
import type { PlaceDetail, VoucherCatalogLine } from "../../place-detail";
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
  { key: "voucher_200", name: "Small", line: "Pay $200MX, get $220MX.", limit: "As many as you like.", bonus: "10% bonus", short: "Small Bonus", brief: "As many as you like" },
  { key: "voucher_1000", name: "Medium", line: "Pay $1,000MX, get $1,200MX.", limit: "As many as you like.", bonus: "20% bonus", short: "Medium Bonus", brief: "As many as you like" },
  { key: "voucher_5000", name: "Big", line: "Pay $5,000MX, get $6,500MX.", limit: "As many as you like.", bonus: "30% bonus", short: "Big Bonus", brief: "As many as you like" },
];

const SPECIAL: Product[] = [
  { key: "voucher_welcome", name: "Welcome", line: "Pay $100MX, get $130MX.", limit: "One, on your first visit.", bonus: "30% bonus", short: "Welcome Bonus", brief: "First visit only" },
  { key: "voucher_story", name: "Story", line: "Pay $100MX, get $130MX.", limit: "One per day.", bonus: "30% bonus", short: "Story Bonus", brief: "Post a story · 1/day" },
  { key: "voucher_vip", name: "VIP", line: "Pay $100MX, get $130MX.", when: "VIP guests only.", limit: "One per day.", bonus: "30% bonus", short: "VIP Bonus", brief: "VIP guests · 1/day" },
];

/** "$1,200MX" from cents. Formatting only, never arithmetic. */
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
    }).format(cents / 100).replace(/^(-?)\$(.*)$/, code === "MXN" ? "$1$$$2MX" : "$1$$$2");
  } catch {
    return `${(cents / 100).toFixed(whole ? 0 : 2)} ${code}`;
  }
}

/** The credit: the server's, else from the copy. */
function creditValue(product: Product, line: VoucherCatalogLine | undefined, currency: string): string {
  if (line) return pesos(line.credit_cents, currency);
  const m = /get (\$[\d,]+MX)/.exec(product.line);
  return m ? m[1] : product.name;
}
/** What a guest pays: the server's, else from the copy. */
function priceValue(product: Product, line: VoucherCatalogLine | undefined, currency: string): string {
  if (line) return pesos(line.price_cents, currency);
  const m = /Pay (\$[\d,]+MX)/.exec(product.line);
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


/** A section title on the one-screen Offers page: 16px (MESITA-3452). */
const OFFERS_TITLE_CLASS = "text-foreground font-sans text-base leading-tight font-semibold";

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
  const green: Face = { card: "bg-green-200 text-neutral-950", ...LIGHT };
  return {
    voucher_200: green,
    voucher_1000: green,
    voucher_5000: green,
    voucher_welcome: { card: "bg-blue-200 text-neutral-950", ...LIGHT, Mark: PartyPopper },
    voucher_story: { card: "bg-pink-200 text-neutral-950", ...LIGHT, Mark: Instagram },
    voucher_vip: { card: "bg-amber-200 text-neutral-950", ...LIGHT, Mark: Crown },
  };
})();

/** Mesita Pay's face: the vouchers' light green (MESITA-3480). */
const CASHBACK_FACE: Face = { card: "bg-green-200 text-neutral-950", ...LIGHT, Mark: BadgePercent };

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
function InfoButton({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
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
        className="text-muted-foreground hover:text-foreground relative flex h-5 w-5 items-center justify-center rounded-full after:absolute after:-inset-2.5"
        data-offer-info
      >
        <Info className="h-4 w-4" aria-hidden />
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <span
          className="fixed inset-0 z-[135] flex items-center justify-center bg-black/40 p-6"
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
            <span className="text-muted-foreground overflow-y-auto text-sm leading-snug font-normal">{text}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              autoFocus
              className="bg-foreground text-paper h-10 rounded-xl text-sm font-semibold hover:opacity-90"
            >
              Got it
            </button>
          </span>
        </span>,
        document.body,
      )
      : null}
    </span>
  );
}

/** What each offer's (i) says (MESITA-3492's paragraphs, one per offer),
 *  with the row's own Pay and Get. */
function offerInfo(key: MoneyVoucherKey, pay: string, get: string, bonus: string): string {
  switch (key) {
    case "voucher_200":
    case "voucher_1000":
    case "voucher_5000":
      return `Pay ${pay} and get ${get} in credits for this place: the place adds ${bonus} on top. Pick it, tap the black button and pay; your credits are ready within an hour. Use them to pay your bill here in the app. They only work at this place, and you can buy as many as you like.`;
    case "voucher_welcome":
      return `A thank-you for trying this place for the first time: pay ${pay}, get ${get} in credits. One per place: once you've had it here it's gone for this place, but every other place on Mesita has its own Welcome waiting for you.`;
    case "voucher_story":
      return `Buy the voucher (pay ${pay}), then activate it by posting an Instagram story at the place. Once your story is up, the ${get} in credits arrive right away and you pay your bill with them. One per visit.`;
    case "voucher_vip":
      return `Reserved for Mesita's VIP Class. VIP guests are onboarded by hand: models, modeling agencies, creators and other guests places want to see. If you're VIP, pay ${pay} and get ${get} in credits here. One per visit. Not VIP? You won't be able to buy this one.`;
  }
}

/** THE WALLET PILL (Pato, MESITA-3483, with inKind's "Load your wallet":
 *  "show the wallet on top ... profile picture of place joined to amount of
 *  credits and wallet icon"): the Offers page's top-bar right slot, where the
 *  three dots were. The place's small photo, a wallet mark and the guest's
 *  available credits here (list-vouchers' balance; formatted, never added).
 *  It replaced the House Card strip (MESITA-3448..3454). */
export function OffersWalletPill({ place }: { place: PlaceDetail }) {
  const balance = place.money?.balance ?? null;
  const currency = place.money?.currency ?? "mxn";
  const available = balance?.available_cents ?? 0;
  const pending = balance?.pending_cents ?? 0;
  const spoken = `Your credits here: ${pesos(available, currency)}${pending > 0 ? `, ${pesos(pending, currency)} pending` : ""}`;
  return (
    <span
      className="mr-1.5 flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-neutral-950 pr-3 pl-1 text-white"
      aria-label={spoken}
      data-place-credit
    >
      <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white/10 ring-2 ring-white" aria-hidden>
        {place.photos.length > 0 ? (
          <SizedImg src={place.photos[0]} size="thumb" alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs font-semibold">{firstInitial(place.name)}</span>
        )}
      </span>
      <Wallet className="h-4 w-4 shrink-0" aria-hidden />
      <span className="text-sm font-bold tabular-nums" aria-hidden>
        {pesos(available, currency)}
      </span>
    </span>
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
    if (focus === "payment") return;
    // "special" and "prepayment" open the one catalog (MESITA-3472).
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
  // SELECT, THEN BUY (MESITA-3487, Pato: "you select then you click Buy.
  // selector at the right").
  const [picked, setPicked] = useState<MoneyVoucherKey | null>(null);

  // SIZES FIRST (MESITA-3484, Pato: "Small Bonus, Mid Bonus, Big Bonus /
  // Welcome Bonus, Story Bonus, VIP Bonus").
  const products = [...STANDARD, ...SPECIAL];
  const chosen = picked && !loading && buyable(picked) ? products.find((p) => p.key === picked) ?? null : null;
  // SHORTER ROWS, SYMMETRIC NAMES (MESITA-3490, Pato: "make the items a bit
  // shorter"; "Mesita Pay Cashback ... External Pay Cashback").
  const ROW = "flex w-full items-center gap-3 px-4 py-2 text-left";
  const CHIP = "flex h-11 w-[72px] shrink-0 items-center justify-center rounded-xl text-xl font-extrabold tracking-tight tabular-nums";

  return (
    // A LIST (MESITA-3486, Pato: "make the things as a list, not as boxes"):
    // two cards of rows, each led by its big number. A prepayment row you can
    // buy carries a selector at its right; the one Buy sits at the foot
    // (MESITA-3487). No Pay bill here.
    <div className="bg-card -mx-4 -mt-4 flex flex-1 shrink-0 flex-col gap-3 px-4 pt-4 pb-4" data-promos-page>
      <section ref={prepaymentRef} className="flex flex-col gap-2" aria-labelledby="rewards-prepayment" data-promos="prepayment">
        <SectionTitle
          id="rewards-prepayment"
          title="Prepayment Offers"
        />
        <ul className="border-border divide-border divide-y rounded-2xl border" data-voucher-catalog>
          {products.map((p) => {
            const line = catalog[p.key];
            const pay = priceValue(p, line, currency);
            const get = creditValue(p, line, currency);
            const deal = `Pay ${pay}, Get ${get}`;
            const reason = unavailable[p.key];
            const can = !loading && buyable(p.key);
            const face = FACES[p.key];
            const Mark = face.Mark;
            const opening = actions?.buyingVoucher === p.key;
            const on = chosen?.key === p.key;
            const inner = (
              <>
                <span className={cn(CHIP, face.card)} aria-hidden>
                  +{p.bonus.replace(/ bonus$/, "")}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1 text-base font-semibold">
                    <span className="flex items-center gap-1" aria-hidden>
                      {Mark ? <Mark className="h-4 w-4 shrink-0" strokeWidth={2.25} /> : null}
                      {p.short}
                    </span>
                    <InfoButton title={p.short} text={offerInfo(p.key, pay, get, p.bonus.replace(/ bonus$/, ""))} />
                  </span>
                  <span className="text-muted-foreground truncate text-sm tabular-nums" aria-hidden>
                    {opening ? "Opening…" : loading || can ? `Pay ${pay} · Get ${get}` : tag(reason)}
                  </span>
                </span>
              </>
            );
            return (
              <li key={p.key} data-voucher={p.key} className={cn(!loading && !can && dim && "opacity-50")}>
                {can ? (
                  <label className={cn(ROW, "hover:bg-muted/50 cursor-pointer")}>
                    <input
                      type="radio"
                      name="voucher"
                      value={p.key}
                      checked={on}
                      onChange={() => setPicked(p.key)}
                      aria-label={`Choose the ${p.name} voucher, ${deal}`}
                      className="sr-only"
                    />
                    {inner}
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                        on ? "border-foreground" : "border-border",
                      )}
                      aria-hidden
                    >
                      {on ? <span className="bg-foreground h-3 w-3 rounded-full" /> : null}
                    </span>
                  </label>
                ) : (
                  <div className={ROW} aria-label={`${p.name} voucher, ${deal}. ${loading ? "" : tag(reason)}`}>
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <section className="flex flex-col gap-2" aria-labelledby="rewards-payment" data-promos="payment">
        <SectionTitle
          id="rewards-payment"
          title="Payment Offers"
        />
        <ul className="border-border divide-border divide-y rounded-2xl border" data-cashback>
          <li
            className={cn(ROW, !loading && !cashback && dim && "opacity-50")}
            aria-label={`Mesita Pay Cashback: pay the bill here with Mesita, 5% comes back as credits, any visit. ${loading ? "" : cashbackTag}`}
          >
            <span className={cn(CHIP, CASHBACK_FACE.card)} aria-hidden>
              +5%
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-1 text-base font-semibold">
                <span aria-hidden>Mesita Pay Cashback</span>
                <InfoButton
                  title="Mesita Pay Cashback"
                  text="Pay your bill here in the app and 5% of it comes back as credits for your next visit, every visit. A $500MX bill gives you $25MX back."
                />
              </span>
              <span className="text-muted-foreground text-sm" aria-hidden>{canPay || loading ? "Back in credits, any visit" : cashbackTag}</span>
            </span>
          </li>
          <li className={ROW} aria-label="External Pay Cashback: pay the place directly, by cash or their terminal. Nothing back.">
            <span className={cn(CHIP, "bg-muted text-muted-foreground")} aria-hidden>
              0%
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-1 text-base font-semibold">
                <span className="flex items-center gap-1" aria-hidden>
                  <Banknote className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                  External Pay Cashback
                </span>
                <InfoButton
                  title="External Pay Cashback"
                  text="Pay the place directly, in cash or on their card terminal. That works too, but nothing comes back."
                />
              </span>
              <span className="text-muted-foreground text-sm" aria-hidden>Cash or their terminal, nothing back</span>
            </span>
          </li>
        </ul>
      </section>
      {/* ONE BUY AT THE FOOT (MESITA-3487): pick a row, then Buy. No Pay bill
          here (MESITA-3486). */}
      <div className="bg-card border-border sticky bottom-0 -mx-4 mt-auto -mb-4 border-t px-4 py-3" data-promos="checkout">
        <button
          type="button"
          onClick={chosen && live ? () => actions?.onBuyVoucher?.(chosen.key) : undefined}
          disabled={!chosen || !live || buying}
          aria-label={chosen ? `Buy the ${chosen.name} voucher` : "Select an offer to buy"}
          className="bg-foreground text-paper flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold hover:opacity-90 disabled:opacity-40"
          data-voucher-buy={chosen?.key}
        >
          {chosen
            ? actions?.buyingVoucher === chosen.key
              ? "Opening…"
              : `Pay ${priceValue(chosen, catalog[chosen.key], currency)}, Get ${creditValue(chosen, catalog[chosen.key], currency)}`
            : "Select an offer"}
        </button>
      </div>
    </div>
  );
}
