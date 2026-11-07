"use client";

import { type ComponentType, type ReactNode, useEffect } from "react";
import { Crown, Hand, QrCode, Wallet } from "lucide-react";

import type { PlaceActions } from "../../actions";
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

/** A card's mark: a lucide glyph, or the Instagram one drawn here (lucide
 *  carries no brand glyphs; the same paths as the Business views log). */
type Mark = ComponentType<{ className?: string; strokeWidth?: number }>;

function InstagramMark({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="20" x="2" y="2" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

type Product = {
  key: MoneyVoucherKey;
  /** The product's name on the row: the amount, or the special's name. */
  name: string;
  /** What the guest gets, in one line (the copy when the read has no catalog). */
  line: string;
  /** The condition, when the voucher has one. */
  when?: string;
  /** How many a guest can have (Pato, MESITA-3328: "mention the inventory"). */
  limit: string;
  bonus: string;
  mark: Mark;
  /** The mark's tile and the mark on it. */
  tone: string;
};

// FIVE HUES, ONE PER KIND (Pato, MESITA-3347: "think colour psychology ...
// five different colours"): Welcome sky (trust, a first hello; MESITA-3346),
// Story pink (Instagram), VIP violet (exclusivity; yellow read as a warning
// tint beside amber), the standard three emerald (money, credit), Cashback
// amber (coins coming back). Business › Payments' rows wear the same.
const STANDARD_TONE = "bg-emerald-100 text-emerald-700";

// THE STANDARD THREE ARE NAMED, NOT PRICED (Pato, MESITA-3362: "the name
// of the thing should be Welcome, Story, VIP, Standard, Medium Standard,
// Large Standard"): the exchange line carries the amounts.
const STANDARD: Product[] = [
  { key: "voucher_200", name: "Standard", line: "Pay MX$200, get MX$220.", limit: "As many as you like.", bonus: "10% Bonus", mark: Wallet, tone: STANDARD_TONE },
  { key: "voucher_1000", name: "Standard Medium", line: "Pay MX$1,000, get MX$1,200.", limit: "As many as you like.", bonus: "20% Bonus", mark: Wallet, tone: STANDARD_TONE },
  { key: "voucher_5000", name: "Standard Large", line: "Pay MX$5,000, get MX$6,500.", limit: "As many as you like.", bonus: "30% Bonus", mark: Wallet, tone: STANDARD_TONE },
];

const SPECIAL: Product[] = [
  { key: "voucher_welcome", name: "Welcome", line: "Pay MX$100, get MX$130.", limit: "One, on your first visit.", bonus: "30% Bonus", mark: Hand, tone: "bg-sky-100 text-sky-700" },
  { key: "voucher_story", name: "Story", line: "Pay MX$100, get MX$130.", limit: "One per day.", bonus: "30% Bonus", mark: InstagramMark, tone: "bg-pink-100 text-pink-700" },
  { key: "voucher_vip", name: "VIP", line: "Pay MX$100, get MX$130.", when: "VIP guests only.", limit: "One per day.", bonus: "30% Bonus", mark: Crown, tone: "bg-violet-100 text-violet-700" },
];

const CASHBACK_TONE = "bg-amber-100 text-amber-700";

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

/** The deal in one line, "Pay X, get Y.", from the server's catalog, else
 *  the copy (Pato, MESITA-3342: "clearer text"; "Get Y of credit" until
 *  then, which hid what a guest pays). */
function creditLine(product: Product, line: VoucherCatalogLine | undefined, currency: string): string {
  if (!line) return product.line;
  return `Pay ${pesos(line.price_cents, currency)}, get ${pesos(line.credit_cents, currency)}.`;
}
/** What you pay, on its own line in the grid: "Pay MX$100"; Story adds the
 *  post (Pato, MESITA-3364: "Pay X & post story, get Y"). */
function forLine(product: Product, line: VoucherCatalogLine | undefined, currency: string): string {
  const pay = priceValue(product, line, currency);
  return product.key === "voucher_story" ? `for ${pay} & a story` : `for ${pay}`;
}
/** The exchange in words: "Pay MX$100, get MX$130"; Story adds the post
 *  (Pato, MESITA-3364: "Pay X & post story, get Y"). The aria label. */
function exchangeLine(product: Product, line: VoucherCatalogLine | undefined, currency: string): string {
  const pay = priceValue(product, line, currency);
  const get = creditValue(product, line, currency);
  return product.key === "voucher_story"
    ? `Pay ${pay} & post a story, get ${get}`
    : `Pay ${pay}, get ${get}`;
}
/** The credit alone, big on the card: the server's, else from the copy. */
function creditValue(product: Product, line: VoucherCatalogLine | undefined, currency: string): string {
  if (line) return pesos(line.credit_cents, currency);
  const m = /get (MX\$[\d,]+)/.exec(product.line);
  return m ? m[1] : product.name;
}
/** What a guest pays, "for MX$100": the server's, else from the copy. */
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

const buyButton = cn(PLACE_BUTTON_CLASS, "bg-foreground text-paper shrink-0 px-4 hover:opacity-90 disabled:opacity-60");

/** A Rewards section title: 18px, the screen title's size, on a tight line.
 *  The tab is Rewards since MESITA-3376 (Pato: "rename Promos to Rewards or
 *  Perks"; Promos from MESITA-3322, Vouchers before). */
const PROMOS_TITLE_CLASS = cn(PLACE_SCREEN_TITLE_CLASS, "leading-tight");
/** ONE ROW CARD for every reward (MESITA-3387, Pato: "do this credits boxes
 *  horizontal"; MESITA-3388 put the cashback on it too, "symmetry and
 *  modularity"): the words on the left, the action in a 96px slot on the
 *  right. A hairline in the card's own hue at half strength holds the pale
 *  tint's edge (MESITA-3357/3366); `border-current` reads the tone's ink. */
const ROW_CARD = "relative flex items-center gap-3 overflow-hidden rounded-xl border border-current/50 p-3";
// ONE BADGE (MESITA-3379): the 12px pill on every row.
const ROW_BADGE = cn(PLACE_PILL_CLASS, "bg-card/85 text-foreground shrink-0");

/** The row's shell: name and badge, "Get X" big, the line under it, a small
 *  last line, and the right slot. */
function RowCard({
  tone,
  dimmed,
  name,
  badge,
  get,
  sub,
  small,
  right,
  ...rest
}: {
  tone: string;
  dimmed: boolean;
  name: string;
  badge: string;
  get: string;
  sub: string;
  small?: string;
  right: ReactNode;
  "aria-label": string;
  "data-voucher"?: string;
  "data-cashback"?: boolean;
}) {
  return (
    <li className={cn(ROW_CARD, tone, dimmed && "opacity-50 grayscale")} {...rest}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-foreground text-sm leading-tight font-semibold">{name}</p>
          <span className={ROW_BADGE}>{badge}</span>
        </div>
        <p className="text-foreground mt-1 text-lg leading-tight font-bold tabular-nums" data-voucher-credit>
          {get}
        </p>
        <p className="text-foreground/80 text-sm leading-snug tabular-nums">{sub}</p>
        {small ? <p className="text-foreground/70 text-xs leading-snug">{small}</p> : null}
      </div>
      <div className="w-24 shrink-0">{right}</div>
    </li>
  );
}

/** The right slot while list-vouchers has not answered (MESITA-3388): a
 *  44px bone, so no card flashes grey with "Not at this place yet". */
function SlotBone() {
  return <div className={cn(PLACE_BONE_CLASS, "h-11 w-full")} aria-hidden data-reward-loading />;
}

/** The state where Buy or Pay would be, right-aligned, objective. */
function SlotTag({ children }: { children: string }) {
  return <p className="text-foreground/70 text-right text-xs leading-snug font-medium">{children}</p>;
}

function VoucherCard({
  product,
  reason,
  line,
  currency,
  actions,
  dim,
  loading,
}: {
  product: Product;
  reason: VoucherReason | undefined;
  line: VoucherCatalogLine | undefined;
  currency: string;
  actions?: PlaceActions;
  /** Grey out a card not for sale (live mode); test mode keeps the colour. */
  dim: boolean;
  /** The offer is still loading: colour, and a bone in the slot. */
  loading: boolean;
}) {
  const forSale = reason === undefined;
  const live = Boolean(actions?.onBuyVoucher);
  const buying = actions?.buyingVoucher === product.key;
  const text = creditLine(product, line, currency);
  // Buyable: for sale, or in test mode any card the server has not used up
  // or paused (Pato, MESITA-3342: "must be buyable or whatever").
  const buyable = forSale || (!dim && reason !== "used" && reason !== "paused");
  return (
    <RowCard
      tone={product.tone}
      dimmed={!loading && !forSale && dim}
      name={product.name}
      badge={product.bonus}
      get={`Get ${creditValue(product, line, currency)}`}
      sub={forLine(product, line, currency)}
      small={product.limit}
      aria-label={`${product.name} voucher, ${product.bonus}, ${text} ${product.when ?? ""} ${loading ? "" : tag(reason)}`}
      data-voucher={product.key}
      right={
        loading ? (
          <SlotBone />
        ) : buyable ? (
          <button
            type="button"
            {...inertButtonProps(live)}
            onClick={live ? () => actions?.onBuyVoucher?.(product.key) : undefined}
            disabled={buying || (actions?.buyingVoucher != null && !buying)}
            aria-label={`Buy the ${product.name} voucher`}
            className={cn(buyButton, "w-full px-2")}
          >
            {buying ? "Opening…" : "Buy"}
          </button>
        ) : (
          <SlotTag>{tag(reason)}</SlotTag>
        )
      }
    />
  );
}

/** A section's head (MESITA-3388, Pato: "clearly divide sections"): the
 *  hero tile's mark on the hero tile's green (ProfileActions: green-400,
 *  neutral-950 ink), so Pay and Prepay up top name the section they open,
 *  then the 18px title over one grey line. */
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

export function VouchersPane({ place, actions }: { place: PlaceDetail; actions?: PlaceActions }) {
  const onLoad = actions?.onLoadVouchers;
  useEffect(() => {
    onLoad?.();
  }, [onLoad]);

  const money = place.money;
  // The host is still asking list-vouchers and the place read carried no
  // offer: draw the colour and bones, never a guess (MESITA-3388).
  const loading = actions?.vouchersLoading === true && !money;
  // A Google-only card or an older read has no money: every switch reads off.
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
  const cashbackTag = state.cashback ? "Available here" : "Not at this place yet";
  // IN TEST MODE EVERY CARD KEEPS ITS COLOUR (Pato, MESITA-3334: "since is
  // test, use fucking colors for the promos, why is like light representing
  // blocked or disabled buttons"): the tag alone says where a voucher
  // stands; the dimmed, greyed card is for live mode.
  const dim = money?.test_mode !== true;
  return (
    // A WHITE PAGE FOR REWARDS ALONE (Pato, MESITA-3366): the pane undoes
    // the body's 16px sides and the 16px under the sticky strip
    // (MESITA-3379) and paints itself white.
    //
    // TWO SECTIONS, CLEARLY DIVIDED (Pato, MESITA-3388: "Payment Rewards /
    // Prepayment Rewards — clearly divide sections"): each section on the
    // white with its own head, and between them an 8px band of the page's
    // grey, edge to edge, the grouped-list gap a guest already reads as "a
    // new section". A 1px hairline (MESITA-3369) read as one more card edge.
    // PAYMENT FIRST (Pato, MESITA-3350: "move payments to the top").
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
        <ul className="flex flex-col gap-2">
          {/* THE CASHBACK IS A ROW LIKE THE SIX (MESITA-3388): "Get 5% back"
              at the vouchers' "Get MX$130" size, Pay in the same slot as
              Buy (MESITA-3352: the host's Pay page; a host without onPay
              draws the state). The coin watermark and the 24px figure of
              MESITA-3363 went with the gift-card face. */}
          <RowCard
            tone={CASHBACK_TONE}
            dimmed={!loading && !state.cashback && dim}
            name="Cashback"
            badge="5% Back"
            get="Get 5% back"
            sub="Pay by card here, 5% comes back as credit."
            aria-label={`5% Cashback, pay by card here and 5% of it comes back as credit. ${loading ? "" : cashbackTag}`}
            data-cashback
            right={
              loading ? (
                <SlotBone />
              ) : actions?.onPay ? (
                <button type="button" onClick={actions.onPay} aria-label="Pay here with Mesita" className={cn(buyButton, "w-full px-2")}>
                  Pay
                </button>
              ) : (
                <SlotTag>{cashbackTag}</SlotTag>
              )
            }
          />
        </ul>
      </section>
      <div className="bg-background h-2" aria-hidden data-rewards-divider />
      <section className="flex flex-col gap-3 px-4 pt-6 pb-4" aria-labelledby="rewards-prepayment" data-promos="prepayment">
        {/* ONE GREY LINE (MESITA-3388): the hour (Pato, MESITA-3323:
            "Prepayments must be one [hour] before the bill. All but the
            Instagram one"; the catalog's available_after_sec, MESITA-3302)
            folds into the subtitle; it was a second paragraph. */}
        <SectionHead
          id="rewards-prepayment"
          Mark={Wallet}
          title="Pre-Payment Rewards"
          subtitle="Credit you buy before you go. Ready in an hour, Story at once."
        />
        {/* ONE COLUMN OF SIX (Pato, MESITA-3387: "vertical list of 6
            items"; the 2×3 grid of MESITA-3371 before). Specials first,
            then the standard three (MESITA-3328). */}
        <ul className="flex flex-col gap-2" data-voucher-catalog>
          {[...SPECIAL, ...STANDARD].map((p) => (
            <VoucherCard
              key={p.key}
              product={p}
              reason={unavailable[p.key]}
              line={catalog[p.key]}
              currency={currency}
              actions={actions}
              dim={dim}
              loading={loading}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
