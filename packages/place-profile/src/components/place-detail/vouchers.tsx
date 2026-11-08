"use client";

import { type ComponentType, useEffect, useRef, useState } from "react";
import { QrCode, Wallet } from "lucide-react";

import type { PlaceActions, RewardsSection } from "../../actions";
import { inertButtonProps } from "../../actions";
import { cn } from "../../lib/format";
import {
  PLACE_BONE_CLASS,
  PLACE_BUTTON_CLASS,
  PLACE_META_CLASS,
  PLACE_PILL_CLASS,
  PLACE_SCREEN_TITLE_CLASS,
} from "../../lib/ui";
import { moneyState, type MoneyVoucherKey, type VoucherReason } from "../../money-state";
import type { PlaceDetail, VoucherCatalogLine } from "../../place-detail";
import { TestBand } from "../TestBand";
import { Box } from "./box";

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
};

// THE STANDARD THREE ARE NAMED, NOT PRICED (Pato, MESITA-3362: "the name
// of the thing should be Welcome, Story, VIP, Standard, Medium Standard,
// Large Standard"): the deal line carries the amounts.
const STANDARD: Product[] = [
  { key: "voucher_200", name: "Standard", line: "Pay MX$200, get MX$220.", limit: "As many as you like.", bonus: "10% Bonus" },
  { key: "voucher_1000", name: "Standard Medium", line: "Pay MX$1,000, get MX$1,200.", limit: "As many as you like.", bonus: "20% Bonus" },
  { key: "voucher_5000", name: "Standard Large", line: "Pay MX$5,000, get MX$6,500.", limit: "As many as you like.", bonus: "30% Bonus" },
];

const SPECIAL: Product[] = [
  { key: "voucher_welcome", name: "Welcome", line: "Pay MX$100, get MX$130.", limit: "One, on your first visit.", bonus: "30% Bonus" },
  { key: "voucher_story", name: "Story", line: "Pay MX$100, get MX$130.", limit: "One per day.", bonus: "30% Bonus" },
  { key: "voucher_vip", name: "VIP", line: "Pay MX$100, get MX$130.", when: "VIP guests only.", limit: "One per day.", bonus: "30% Bonus" },
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
/** The card of rows: one hairline edge, rows split by hairlines (inKind). */
const LIST_CARD = "divide-border overflow-hidden rounded-xl border divide-y";
/** The bonus: a green pill, white ink (inKind's "25% Bonus"). */
const BONUS_PILL = cn(PLACE_PILL_CLASS, "shrink-0 bg-green-600 py-1 text-white");

/** The radio's circle: hollow, filled with an ink dot when chosen. */
function RadioDot({ on, hidden }: { on: boolean; hidden?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
        on ? "border-foreground" : "border-foreground/30",
        hidden && "invisible",
      )}
    >
      {on ? <span className="bg-foreground h-2.5 w-2.5 rounded-full" /> : null}
    </span>
  );
}

/** One row's words: the deal big, the small line under it. */
function RowWords({ deal, small }: { deal: string; small: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-foreground text-base leading-snug font-semibold tabular-nums" data-voucher-deal>
        {deal}
      </span>
      <span className="text-muted-foreground text-xs leading-snug">{small}</span>
    </span>
  );
}

const ROW = "flex items-center gap-3 px-3 py-3.5";

/** A section's head (MESITA-3388, Pato: "clearly divide sections"): the
 *  hero tile's mark on the hero tile's green, then the 18px title over one
 *  grey line. */
function SectionHead({ id, Mark, title, subtitle }: { id: string; Mark: Mark; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-400 text-neutral-950" aria-hidden>
        <Mark className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <h3 id={id} className={PROMOS_TITLE_CLASS}>
          {title}
        </h3>
        <p className={PLACE_META_CLASS}>{subtitle}</p>
      </div>
    </div>
  );
}

type Mark = ComponentType<{ className?: string; strokeWidth?: number }>;

/** The action's place while list-vouchers has not answered (MESITA-3388). */
function ActionBone() {
  return <div className={cn(PLACE_BONE_CLASS, "h-11 w-full")} aria-hidden data-reward-loading />;
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
  const [picked, setPicked] = useState<MoneyVoucherKey | null>(null);

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
  const balance = money?.balance ?? null;
  const hasCredit = !!balance && balance.available_cents + balance.pending_cents + balance.held_cents > 0;
  // IN TEST MODE NOTHING IS GREYED (Pato, MESITA-3334); live mode dims a row
  // not for sale.
  const dim = money?.test_mode !== true;
  const cashback = money?.cashback === true;
  const cashbackTag = cashback ? "Available here" : "Not at this place yet";
  // Pay shows where the 5% comes back, or in test mode (MESITA-3397): a live
  // Pay at a place without cashback promised 5% that never comes.
  const canPay = Boolean(actions?.onPay) && (cashback || !dim);

  const products = [...SPECIAL, ...STANDARD];
  // Buyable: for sale, or in test mode any row the server has not used up or
  // paused (Pato, MESITA-3342: "must be buyable or whatever").
  const buyable = (k: MoneyVoucherKey) => {
    const reason = unavailable[k];
    return reason === undefined || (!dim && reason !== "used" && reason !== "paused");
  };
  const firstBuyable = products.find((p) => buyable(p.key))?.key ?? null;
  const chosenKey = picked && buyable(picked) ? picked : firstBuyable;
  const chosen = products.find((p) => p.key === chosenKey) ?? null;
  const live = Boolean(actions?.onBuyVoucher);
  const buying = actions?.buyingVoucher != null;

  return (
    // A WHITE PAGE FOR REWARDS ALONE (Pato, MESITA-3366), two sections split
    // by an 8px band of the page's grey (MESITA-3388). PAYMENT FIRST (Pato,
    // MESITA-3350: "move payments to the top").
    <div className="bg-card -mx-4 -mt-4 flex flex-col pb-2" data-promos-page>
      {money?.test_mode || hasCredit ? (
        <div className="flex flex-col gap-3 px-4 pt-4">
          {money?.test_mode ? <TestBand /> : null}
          {hasCredit && balance ? (
            <Box title="Your credit here">
              <p className="text-foreground text-sm" data-place-credit>
                <span className="font-semibold tabular-nums">{pesos(balance.available_cents, currency)}</span> available
                {balance.pending_cents > 0 ? (
                  <>
                    {" · "}
                    <span className="font-semibold tabular-nums">{pesos(balance.pending_cents, currency)}</span> pending
                  </>
                ) : null}
              </p>
            </Box>
          ) : null}
        </div>
      ) : null}
      <section className="flex flex-col gap-3 px-4 pt-4 pb-6" aria-labelledby="rewards-payment" data-promos="payment">
        <SectionHead id="rewards-payment" Mark={QrCode} title="Payment Rewards" subtitle="When you pay the bill here." />
        <div
          className={cn(LIST_CARD, !loading && !cashback && dim && "opacity-50")}
          aria-label={`5% Cashback: pay here by card, 5% comes back as credit. ${loading ? "" : cashbackTag}`}
          data-cashback
        >
          <div className={ROW}>
            <RowWords deal="Pay here, Get 5% back" small={canPay || loading ? "By card, back as credit." : `By card, back as credit. ${cashbackTag}.`} />
            <span className={BONUS_PILL}>5% Back</span>
          </div>
        </div>
        {loading ? (
          <ActionBone />
        ) : canPay ? (
          <button type="button" onClick={actions?.onPay} aria-label="Pay the bill here with Mesita" className={ACTION_BUTTON}>
            Pay bill
          </button>
        ) : null}
      </section>
      <div className="bg-background h-2" aria-hidden data-rewards-divider />
      <section ref={prepaymentRef} className="flex flex-col gap-3 px-4 pt-6 pb-4" aria-labelledby="rewards-prepayment" data-promos="prepayment">
        <SectionHead
          id="rewards-prepayment"
          Mark={Wallet}
          title="Pre-Payment Rewards"
          subtitle="Credit you buy before you go. Ready in an hour, Story at once."
        />
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="sr-only">Choose a voucher</legend>
          <ul className={LIST_CARD} data-voucher-catalog>
            {products.map((p) => {
              const line = catalog[p.key];
              const pay = priceValue(p, line, currency);
              const get = creditValue(p, line, currency);
              const deal = p.key === "voucher_story" ? `Pay ${pay} & post a story, Get ${get}` : `Pay ${pay}, Get ${get}`;
              const reason = unavailable[p.key];
              const can = !loading && buyable(p.key);
              const on = can && chosenKey === p.key;
              const small = [p.name, p.when, loading || can ? p.limit : tag(reason)].filter(Boolean).join(" · ");
              const inner = (
                <>
                  <RadioDot on={on} hidden={!can} />
                  <RowWords deal={deal} small={small} />
                  <span className={BONUS_PILL}>{p.bonus}</span>
                </>
              );
              return (
                <li key={p.key} data-voucher={p.key} className={cn(!loading && !can && dim && "opacity-50")}>
                  {can ? (
                    <label className={cn(ROW, "cursor-pointer", on && "bg-muted/60")}>
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
        </fieldset>
        {loading ? (
          <ActionBone />
        ) : chosen ? (
          <button
            type="button"
            {...inertButtonProps(live)}
            onClick={live ? () => actions?.onBuyVoucher?.(chosen.key) : undefined}
            disabled={buying}
            aria-label={`Buy the ${chosen.name} voucher`}
            className={ACTION_BUTTON}
            data-voucher-buy
          >
            {actions?.buyingVoucher === chosen.key ? "Opening…" : `Buy for ${priceValue(chosen, catalog[chosen.key], currency)}`}
          </button>
        ) : null}
      </section>
    </div>
  );
}
