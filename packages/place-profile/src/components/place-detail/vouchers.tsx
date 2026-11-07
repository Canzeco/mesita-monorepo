"use client";

import type { ComponentType } from "react";
import { Coffee, Coins, Crown, Hand, Utensils, Wine } from "lucide-react";

import { cn } from "../../lib/format";
import { PLACE_META_CLASS } from "../../lib/ui";
import { moneyState, type MoneyVoucherKey, type VoucherReason } from "../../money-state";
import type { PlaceDetail } from "../../place-detail";
import { Box, BoxHScroll } from "./box";

// THE VOUCHERS TAB IS SIX DIGITAL PRODUCTS (Pato, MESITA-3309: "Make the
// Vouchers graphics. It must look like 6 digital products"). The six
// vouchers are one catalog on the server (VOUCHER_CATALOG, MESITA-3302) and
// the six cards Business › Payments draws (MESITA-3298): Standard MX$200 ·
// MX$1,000 · MX$5,000 and Special Welcome · Story · VIP, each with the same
// mark and colour on both sides (one mark everywhere). A guest sees them as
// products on two shelves: a card per voucher, its mark on its colour, the
// bonus, the price and the credit it buys, in one objective line (Pato: "be
// super objective"); then Cashback, the standard 5%, as one more card.
//
// Every card is always there, so the tab never reads as empty and never
// pretends: a voucher this place sells is lit, and one it does not (the
// owner's switch off, no Stripe account, or not sellable by any wave yet) is
// dimmed with one tag. moneyState (the server's twin) decides which is which.
// Read only: buying arrives with MESITA-3272 W1b (MESITA-3303). The amounts
// are the catalog's and copy here; the server never sells from this list.
//
// decision: the cards carry colour on an achromatic screen (MESITA-2636): a
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
  /** The product's name on the card: the amount, or the special's name. */
  name: string;
  /** What the guest gets, in one line. */
  line: string;
  /** The condition, when the voucher has one. */
  when?: string;
  bonus: string;
  mark: Mark;
  /** The card's face and the mark on it. */
  tone: string;
};

const STANDARD: Product[] = [
  { key: "voucher_200", name: "MX$200", line: "Get MX$220 of credit.", bonus: "+10%", mark: Coffee, tone: "bg-emerald-100 text-emerald-700" },
  { key: "voucher_1000", name: "MX$1,000", line: "Get MX$1,200 of credit.", bonus: "+20%", mark: Utensils, tone: "bg-sky-100 text-sky-700" },
  { key: "voucher_5000", name: "MX$5,000", line: "Get MX$6,500 of credit.", bonus: "+30%", mark: Wine, tone: "bg-violet-100 text-violet-700" },
];

const SPECIAL: Product[] = [
  { key: "voucher_welcome", name: "Welcome", line: "Pay MX$100, get MX$130 of credit.", when: "Once, on your first visit.", bonus: "+30%", mark: Hand, tone: "bg-orange-100 text-orange-700" },
  { key: "voucher_story", name: "Story", line: "Pay MX$100, get MX$130 of credit.", when: "After an Instagram story here.", bonus: "+30%", mark: InstagramMark, tone: "bg-pink-100 text-pink-700" },
  { key: "voucher_vip", name: "VIP", line: "Pay MX$100, get MX$130 of credit.", when: "VIP guests only.", bonus: "+30%", mark: Crown, tone: "bg-yellow-100 text-yellow-700" },
];

const CASHBACK_TONE = "bg-amber-100 text-amber-700";

/** One tag per state, objective: where it stands for this guest at this place. */
function tag(reason: VoucherReason | undefined): string {
  if (!reason) return "Available here";
  if (reason === "off" || reason === "needs_account") return "Not at this place yet";
  return "Coming soon";
}

function VoucherCard({ product, reason }: { product: Product; reason: VoucherReason | undefined }) {
  const Mark = product.mark;
  const on = !reason;
  return (
    <li
      className={cn(
        "border-border bg-card flex w-40 shrink-0 flex-col overflow-hidden rounded-xl border",
        !on && "opacity-50 grayscale",
      )}
      aria-label={`${product.name} voucher, ${product.line} ${tag(reason)}`}
    >
      <div className={cn("relative flex h-24 items-center justify-center", product.tone)} aria-hidden>
        <Mark className="h-9 w-9" strokeWidth={1.75} />
        <span className="bg-card/85 text-foreground absolute top-2 right-2 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums">
          {product.bonus}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <p className="text-foreground text-sm font-semibold">{product.name}</p>
        <p className={PLACE_META_CLASS}>{product.line}</p>
        {product.when ? <p className={PLACE_META_CLASS}>{product.when}</p> : null}
        <p className={cn(PLACE_META_CLASS, "mt-auto pt-1.5 font-medium", on && "text-foreground")}>{tag(reason)}</p>
      </div>
    </li>
  );
}

function Shelf({ title, products, unavailable }: { title: string; products: Product[]; unavailable: Partial<Record<MoneyVoucherKey, VoucherReason>> }) {
  return (
    <Box title={title}>
      <BoxHScroll>
        <ul className="flex gap-3">
          {products.map((p) => (
            <VoucherCard key={p.key} product={p} reason={unavailable[p.key]} />
          ))}
        </ul>
      </BoxHScroll>
    </Box>
  );
}

export function VouchersPane({ place }: { place: PlaceDetail }) {
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
  const cashbackTag = state.cashback ? "Available here" : "Not at this place yet";
  return (
    <div className="flex flex-col gap-3">
      <Shelf title="Standard vouchers" products={STANDARD} unavailable={state.unavailable} />
      <Shelf title="Special vouchers" products={SPECIAL} unavailable={state.unavailable} />
      <Box title="Cashback">
        <div className={cn("flex items-center gap-3", !state.cashback && "opacity-50 grayscale")}>
          <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", CASHBACK_TONE)}>
            <Coins className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-foreground text-sm font-semibold">5% back</p>
            <p className={PLACE_META_CLASS}>Pay by card, get 5% of it back as credit here.</p>
            <p className={cn(PLACE_META_CLASS, "mt-1 font-medium", state.cashback && "text-foreground")}>{cashbackTag}</p>
          </div>
        </div>
      </Box>
    </div>
  );
}
