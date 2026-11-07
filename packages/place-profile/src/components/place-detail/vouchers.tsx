"use client";

import { type ComponentType, useEffect } from "react";
import { Coins, Crown, Hand, Wallet } from "lucide-react";

import type { PlaceActions } from "../../actions";
import { inertButtonProps } from "../../actions";
import { cn } from "../../lib/format";
import { PLACE_BUTTON_CLASS, PLACE_META_CLASS } from "../../lib/ui";
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

const STANDARD_TONE = "bg-emerald-100 text-emerald-700";

const STANDARD: Product[] = [
  { key: "voucher_200", name: "MX$200", line: "Get MX$220 of credit.", limit: "As many as you like.", bonus: "+10%", mark: Wallet, tone: STANDARD_TONE },
  { key: "voucher_1000", name: "MX$1,000", line: "Get MX$1,200 of credit.", limit: "As many as you like.", bonus: "+20%", mark: Wallet, tone: STANDARD_TONE },
  { key: "voucher_5000", name: "MX$5,000", line: "Get MX$6,500 of credit.", limit: "As many as you like.", bonus: "+30%", mark: Wallet, tone: STANDARD_TONE },
];

const SPECIAL: Product[] = [
  { key: "voucher_welcome", name: "Welcome", line: "Pay MX$100, get MX$130 of credit.", limit: "One, on your first visit.", bonus: "+30%", mark: Hand, tone: "bg-orange-100 text-orange-700" },
  { key: "voucher_story", name: "Story", line: "Pay MX$100, get MX$130 of credit.", when: "After an Instagram story here.", limit: "One per story.", bonus: "+30%", mark: InstagramMark, tone: "bg-pink-100 text-pink-700" },
  { key: "voucher_vip", name: "VIP", line: "Pay MX$100, get MX$130 of credit.", when: "VIP guests only.", limit: "Every visit.", bonus: "+30%", mark: Crown, tone: "bg-yellow-100 text-yellow-700" },
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

/** The row's line from the server's catalog, else the copy. */
function creditLine(product: Product, line: VoucherCatalogLine | undefined, currency: string): string {
  if (!line) return product.line;
  return product.when !== undefined
    ? `Pay ${pesos(line.price_cents, currency)}, get ${pesos(line.credit_cents, currency)} of credit.`
    : `Get ${pesos(line.credit_cents, currency)} of credit.`;
}

/** One tag per state, objective: where it stands for this guest at this place. */
function tag(reason: VoucherReason | undefined): string {
  if (!reason) return "Available here";
  if (reason === "off" || reason === "needs_account") return "Not at this place yet";
  if (reason === "paused") return "Paused for a moment";
  if (reason === "used") return "You had yours here";
  return "Coming soon";
}

const buyButton = cn(PLACE_BUTTON_CLASS, "bg-foreground text-paper mt-2 shrink-0 px-4 hover:opacity-90 disabled:opacity-60");

/** One product card, full width: the face on the left, the words on the
 *  right (MESITA-3326). `ProductFace` is shared with the cashback card. */
function ProductFace({ Mark, tone, badge }: { Mark: Mark; tone: string; badge: string }) {
  return (
    <div className={cn("relative flex w-28 shrink-0 items-center justify-center self-stretch", tone)} aria-hidden>
      <Mark className="h-9 w-9" strokeWidth={1.75} />
      <span className="bg-card/85 text-foreground absolute top-2 right-2 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums">
        {badge}
      </span>
    </div>
  );
}

const PRODUCT_CARD = "border-border bg-card flex min-h-28 overflow-hidden rounded-xl border";

function VoucherCard({
  product,
  reason,
  line,
  currency,
  actions,
  dim,
}: {
  product: Product;
  reason: VoucherReason | undefined;
  line: VoucherCatalogLine | undefined;
  currency: string;
  actions?: PlaceActions;
  /** Grey a card the place does not sell: live mode only (MESITA-3334). */
  dim: boolean;
}) {
  const forSale = !reason;
  const live = Boolean(actions?.onBuyVoucher);
  const buying = actions?.buyingVoucher === product.key;
  const text = creditLine(product, line, currency);
  return (
    <li
      className={cn(PRODUCT_CARD, !forSale && dim && "opacity-50 grayscale")}
      aria-label={`${product.name} voucher, ${product.bonus}, ${text} ${product.when ?? ""} ${tag(reason)}`}
      data-voucher={product.key}
    >
      <ProductFace Mark={product.mark} tone={product.tone} badge={product.bonus} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-3">
        <p className="text-foreground text-sm font-semibold">{product.name}</p>
        <p className={PLACE_META_CLASS}>
          {text}
          {product.when ? ` ${product.when}` : null}
        </p>
        <p className={cn(PLACE_META_CLASS, "font-medium")}>{product.limit}</p>
        {forSale ? (
          <button
            type="button"
            {...inertButtonProps(live)}
            onClick={live ? () => actions?.onBuyVoucher?.(product.key) : undefined}
            disabled={buying || (actions?.buyingVoucher != null && !buying)}
            aria-label={`Buy the ${product.name} voucher`}
            className={cn(buyButton, "mt-auto self-start")}
          >
            {buying ? "Opening…" : "Buy"}
          </button>
        ) : (
          <p className={cn(PLACE_META_CLASS, "mt-auto pt-2 font-medium")}>{tag(reason)}</p>
        )}
      </div>
    </li>
  );
}

export function VouchersPane({ place, actions }: { place: PlaceDetail; actions?: PlaceActions }) {
  const onLoad = actions?.onLoadVouchers;
  useEffect(() => {
    onLoad?.();
  }, [onLoad]);

  const money = place.money;
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
    <div className="flex flex-col gap-3">
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
      <Box title="Pre-Payment Promos">
        {/* The hour (Pato, MESITA-3323: "Prepayments must be one [hour]
            before the bill. All but the Instagram one"): every voucher's
            credit turns Available one hour after the charge except Story,
            ready at once (the catalog's available_after_sec, MESITA-3302). */}
        <p className={PLACE_META_CLASS}>
          Buy at least an hour before you pay the bill: the credit takes an hour to be ready. Story is ready at once.
        </p>
        <ul className="flex flex-col gap-3" data-voucher-catalog>
          {[...SPECIAL, ...STANDARD].map((p) => (
            <VoucherCard key={p.key} product={p} reason={unavailable[p.key]} line={catalog[p.key]} currency={currency} actions={actions} dim={dim} />
          ))}
        </ul>
      </Box>
      <Box title="Payment Promos">
        <div
          className={cn(PRODUCT_CARD, !state.cashback && dim && "opacity-50 grayscale")}
          aria-label={`5% Cashback, pay by card here and 5% of it comes back as credit. ${cashbackTag}`}
          data-cashback
        >
          <ProductFace Mark={Coins} tone={CASHBACK_TONE} badge="5%" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-3">
            <p className="text-foreground text-sm font-semibold">5% Cashback</p>
            <p className={PLACE_META_CLASS}>Pay by card here and 5% of it comes back as credit.</p>
            <p className={cn(PLACE_META_CLASS, "mt-auto pt-2 font-medium", state.cashback && "text-foreground")}>{cashbackTag}</p>
          </div>
        </div>
      </Box>
    </div>
  );
}
