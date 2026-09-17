"use client";

// THE CATALOGUE (MESITA-1869) — the eight Mesita products, as cards.
//
// Pato, 2026-09-15, with a mock: *"build something kinda like this, like a
// pretty catalog. Products (here have partner and all the products to
// activate, remember that profile is free)."*
//
// ── WHAT A CARD IS ALLOWED TO SAY ─────────────────────────────────────────
//
// SoonStrip's law runs through this file: an unbuilt engine shows Soon, never
// knobs, never a fake feed and never a fake number. A catalogue is the surface
// where that law is easiest to break — eight boxes with eight green "Enabled"
// chips is a beautiful screen that lies about every one of them. So each card
// carries a state THE SERVER READ, and nothing else:
//
//   free      Mesita Profile. Always on, never a switch — every place has a
//             profile the moment it exists, and there is no column to flip.
//   enabled   the fact is true: `mesita_pay_enabled` for Pay, `partnered` for
//             the two the subscription includes, a place count above zero for
//             the per-place three.
//   off       the same fact, false. The verb points at where it is turned on.
//   locked    true-but-unreachable: the product needs Mesita Partner and the
//             place is not one. A lock, never a disabled Enable button.
//   soon      not built. Mesita Terminal (no hardware) and Mesita Customers
//             (no engine). A product that will be FREE still shows Soon while
//             it does not exist: "free" is a price, and a price is not a
//             reason to paint a green chip on an empty page.
//
// `note` is the second line, and it is a COUNT where one exists — "On at 2 of
// 5 places" is read off `business-web-list-places`, the same payload the
// states matrix renders. A product whose places could not be read carries no
// note at all rather than a zero, because zero is a claim.
//
// ── WHY THE ICONS LIVE HERE AND THE DATA COMES FROM THE SERVER ────────────
//
// A React component is not serializable across the server/client boundary, so
// the page hands over plain data keyed by `ProductKey` and this file owns the
// mark and the tint. That also keeps every product's look in ONE table: eight
// cards drifting into eight palettes is what a catalogue does if you let each
// one carry its own colours.
//
// The filter is why this is a client component at all. Three pills, one piece
// of state, no round trip — and "Not enabled" is the view an operator with a
// fresh place actually wants, because it is the to-do list.

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarCheck,
  Check,
  Globe,
  CreditCard,
  Gift,
  Lock,
  Minus,
  ShoppingBag,
  Store,
  Ticket,
  Users,
  Landmark,
  Megaphone,
  MessageCircle,
  Nfc,
  PhoneCall,
  ScanBarcode,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// THE EIGHT, IN PATO'S ORDER (2026-09-16): *"Profile · Costumers // Visits ·
// Orders · Reservations // Rewards · Payments · Credits"*, with the
// partnership above the grid and not in it.
//
// THE VOCABULARY IS `lib/product-keys.ts`, AND THIS FILE ONLY RE-EXPORTS IT
// (MESITA-1900). MESITA-1885 split the keys out so modules that must not pull
// a "use client" grid into their bundle could still name a product — and then
// left the original list HERE as well. Two lists, and every reader had to pick
// one: `lib/products.ts` took the type from this component, `lib/place-tabs.ts`
// took the labels from the split file. A vocabulary that exists twice is the
// exact failure the split was for, so there is one list and this is not it.
//
// REWARDS IS BACK, AND TERMINAL IS GONE. MESITA-1884 removed the Rewards card
// on Pato's *"should i separate visits and rewards into two?? i don't think
// so."* — a reward being a DIAL inside Visits rather than a thing you buy.
// Pato's 2026-09-16 list separates them and files Rewards under MONEY, beside
// Payments and Credits: it is what the place gives back. The card's state is
// the dial's now, which is honest in the direction MESITA-1882 was not — a
// Rewards card at 0% reads Not on here yet, and nothing on this page claims
// visit checkout is broken because of it.
export { PRODUCT_KEYS } from "@/lib/product-keys";
export type { ProductKey } from "@/lib/product-keys";
import type { ProductKey } from "@/lib/product-keys";

/** The five things a card may claim. Every one is read, never assumed. */
export type ProductState = "free" | "enabled" | "off" | "locked" | "soon";

export type ProductCard = {
  key: ProductKey;
  /** The product's name, as Mesita sells it. Always "Mesita <noun>". */
  name: string;
  /** One clause. What a GUEST gets, not what a column does. */
  blurb: string;
  state: ProductState;
  /** The second line: a real count, a prerequisite, or null. Never a zero
   *  standing in for a read that failed. */
  note: string | null;
  /** Where the product is actually turned on. Null when there is nothing to
   *  open — Customers is not built, and a locked product has no switch to
   *  walk an operator to. */
  action: { label: string; href: string } | null;
};

/** The mark and its tint, one row per product. The tint is a WASH behind a
 *  foreground-weight glyph, not a saturated fill: eight saturated squares in
 *  a grid is a toy, and this screen is where an operator spends money. */
// THE TINTS ARE GONE, ALL SIXTEEN (MESITA-1936, landing after MESITA-1949 and
// doing what that file asked of whichever branch arrived second). This console
// follows the mock: the hues went in MESITA-1934 and the GLYPH became the whole
// of a product's identity. `tint` keeps its name and its shape because the wash
// is still a wash — it is simply the same wash for every product now, which is
// the property that matters. A seventeenth product cannot arrive needing a hue
// nobody has left, and sixteen saturated squares in one grid is a toy on the
// screen where an operator spends money.
const LOOK: Record<ProductKey, { Icon: LucideIcon; tint: string }> = {
  profile: { Icon: Store, tint: "bg-muted text-foreground" },
  website: { Icon: Globe, tint: "bg-muted text-foreground" },
  customers: { Icon: Users, tint: "bg-muted text-foreground" },
  ads: { Icon: Megaphone, tint: "bg-muted text-foreground" },
  visits: { Icon: Ticket, tint: "bg-muted text-foreground" },
  // Rewards takes the slate Terminal left behind rather than the pink it wore
  // before MESITA-1884 — Customers has that now, and moving a live card's
  // colour to give a returning one its old wash would recolour two cards to
  // settle one.
  rewards: { Icon: Gift, tint: "bg-muted text-foreground" },
  orders: { Icon: ShoppingBag, tint: "bg-muted text-foreground" },
  reservations: { Icon: CalendarCheck, tint: "bg-muted text-foreground" },
  pay: { Icon: CreditCard, tint: "bg-muted text-foreground" },
  // TERMINAL DOES NOT GET ITS OLD GLYPH BACK. It wore `CreditCard` until
  // MESITA-1900, when Payments wore something else; handing it back now would
  // put one mark on two cards in the same grid, which is the failure the whole
  // table exists to prevent. `Nfc` is the TAP — the half of Terminal that is
  // not Payments — and `ScanBarcode` is what POS rings up before anybody taps.
  terminal: { Icon: Nfc, tint: "bg-muted text-foreground" },
  pos: { Icon: ScanBarcode, tint: "bg-muted text-foreground" },
  credits: { Icon: Wallet, tint: "bg-muted text-foreground" },
  // Capital takes the BANK'S FRONT for its mark (MESITA-1929) — the same glyph
  // the landing page gives it, because one product drawn two ways is how an
  // operator learns to distrust both drawings.
  capital: { Icon: Landmark, tint: "bg-muted text-foreground" },
  whatsapp: { Icon: MessageCircle, tint: "bg-muted text-foreground" },
  phone: { Icon: PhoneCall, tint: "bg-muted text-foreground" },
  intelligence: { Icon: Sparkles, tint: "bg-muted text-foreground" },
};

/** The state, as the operator reads it. One word where one will do — the
 *  card's own note carries the detail, so the chip never becomes a sentence. */
const STATE_LABEL: Record<ProductState, string> = {
  free: "Enabled",
  enabled: "Enabled",
  off: "Not enabled",
  locked: "Locked",
  soon: "Soon",
};

// STATE IS A SHAPE, NOT A HUE (MESITA-1936). These five used to be three
// tints, and the comments below are the argument for why the three had to
// differ at all — greyscale them and this catalogue, whose entire job is
// saying which products are on, says nothing.
//
// Fill / outline / dashed, the vocabulary the mock shipped in MESITA-1934:
const STATE_CLASS: Record<ProductState, string> = {
  // FILLED is "this is on". Emerald used to say it; ink says it now, and the
  // one product that can never be off wears the same fill as the ones that are.
  free: "bg-foreground text-background",
  enabled: "bg-foreground text-background",
  // OUTLINED, never dashed: not enabled is a CHOICE the operator has not made,
  // not something pending. Grey-never-amber was the old spelling of this same
  // refusal — off is not a debt, and amber stays Stripe's (badges.tsx).
  off: "border border-border text-muted-foreground",
  // GOLD is reserved for a tier the product names out loud, and Locked is
  // exactly that: it is what Mesita Partner buys.
  locked:
    "bg-[color:var(--tier-gold)]/18 text-[color:var(--tier-gold-ink)]",
  // DASHED means "not here yet" everywhere in this codebase.
  soon: "border border-dashed border-border text-muted-foreground",
};

const STATE_GLYPH: Record<ProductState, LucideIcon | null> = {
  free: Check,
  enabled: Check,
  off: Minus,
  locked: Lock,
  soon: null,
};

function StateChip({ state }: { state: ProductState }) {
  const Glyph = STATE_GLYPH[state];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        STATE_CLASS[state],
      )}
    >
      {Glyph && <Glyph className="h-3 w-3" aria-hidden strokeWidth={3} />}
      {STATE_LABEL[state]}
    </span>
  );
}

/** The three filters. "All products" first because the catalogue is also a
 *  price list — an operator who has never seen it needs to read all eight
 *  before they can want one. */
const FILTERS = [
  { key: "all", label: "All products" },
  { key: "on", label: "Enabled" },
  { key: "off", label: "Not enabled" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const ON_STATES: readonly ProductState[] = ["free", "enabled"];

// THE BRAND WASH, WRITTEN AS TOKENS, NOT AS `bg-brand/10`.
//
// `.bg-brand` is a GRADIENT utility (globals.css) — Tailwind cannot take an
// opacity modifier to it, and an unknown class is DROPPED SILENTLY, which is
// the failure globals.css's own comment warns about: it compiles, deploys, and
// renders flat.
//
// THE SOFT PAIR, ACHROMATIC (MESITA-1936). These were the only two strings in
// this app that reached PAST the semantic layer into the brand ramp itself, so
// repointing --primary left them pink while everything around them went ink.
// The ramp is still generated and still pink; nothing here may read it.
const BRAND_SOFT_ON =
  "border-border bg-muted text-foreground";
const BRAND_SOFT_ACTION =
  "bg-muted text-foreground hover:bg-[color:var(--border)]";

export function ProductCatalog({ products }: { products: readonly ProductCard[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const visible = useMemo(
    () =>
      products.filter((p) =>
        filter === "all"
          ? true
          : filter === "on"
            ? ON_STATES.includes(p.state)
            : !ON_STATES.includes(p.state),
      ),
    [products, filter],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* A radiogroup, not a row of buttons: the three are one choice, and a
          screen reader should hear it that way. */}
      <div role="radiogroup" aria-label="Filter products" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const on = filter === f.key;
          const count = products.filter((p) =>
            f.key === "all"
              ? true
              : f.key === "on"
                ? ON_STATES.includes(p.state)
                : !ON_STATES.includes(p.state),
          ).length;
          return (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setFilter(f.key)}
              className={cn(
                "focus-visible:ring-foreground/30 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition outline-none focus-visible:ring-2",
                on
                  ? BRAND_SOFT_ON
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {f.label}
              <span className={cn("tabular-nums", on ? "opacity-70" : "opacity-60")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        // Reachable: a fresh place filtered to Enabled sees Profile
        // only, and a fully-enabled one filtered to Not enabled sees nothing.
        // A grid that silently empties reads as a failed load.
        <p className="text-muted-foreground border-border rounded-2xl border border-dashed p-6 text-center text-[13px]">
          No products match this filter.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((p) => (
            <ProductTile key={p.key} product={p} />
          ))}
        </ul>
      )}

      {/* The one cost the cards themselves must not carry: a per-card "extra
          fees may apply" on two of eight is noise on all eight. */}
      <p className="text-muted-foreground text-[12px] leading-snug">
        Payment processing and hardware may have costs of their own.
      </p>
    </div>
  );
}

function ProductTile({ product }: { product: ProductCard }) {
  const { Icon, tint } = LOOK[product.key];
  return (
    <li
      className={cn(
        // Section's geometry (rounded-2xl, border, card) so a product tile and
        // a console box are visibly the same family. What differs is the LIFT:
        // a live product lifts, a Soon one lies flat — the rank-by-depth rule
        // SoonStrip.tsx wrote, applied to a grid.
        "border-border bg-card flex min-w-0 flex-col gap-3 rounded-2xl border p-4 transition",
        product.state === "soon"
          ? "border-dashed"
          : "shadow-card hover:border-foreground/20",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          tint,
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>

      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="font-display text-sm font-semibold tracking-tight">
          {product.name}
        </h3>
        <p className="text-muted-foreground text-[12px] leading-snug">
          {product.blurb}
        </p>
      </div>

      {/* THE CHIP FOLLOWS THE BLURB; ONLY THE VERB IS PINNED.
          Bottom-aligning the whole block was the obvious move and it is the
          wrong one: Mesita Terminal has no verb, so its block is a row
          shorter, and its Soon chip floated ~20px BELOW every other card's
          chip in the same grid row. One tile out of line reads as a bug, not
          as a difference. `mt-auto` on the action alone puts every button on
          one baseline and lets the chips align with each other. */}
      <div className="flex flex-col gap-2">
        <StateChip state={product.state} />
        {product.note && (
          <p className="text-muted-foreground text-[12px] leading-snug">
            {product.note}
          </p>
        )}
      </div>
      {product.action && (
        <Link
          href={product.action.href}
          className={cn(
            "focus-visible:ring-foreground/30 mt-auto inline-flex h-9 w-full items-center justify-center rounded-xl text-[12px] font-semibold transition outline-none focus-visible:ring-2",
            ON_STATES.includes(product.state)
              ? BRAND_SOFT_ACTION
              : "border-border text-foreground hover:border-foreground/30 border",
          )}
        >
          {product.action.label}
        </Link>
      )}
    </li>
  );
}
