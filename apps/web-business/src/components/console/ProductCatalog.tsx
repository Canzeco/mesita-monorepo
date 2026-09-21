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
// ── WHY THE MARKS LIVE HERE AND THE DATA COMES FROM THE SERVER ────────────
//
// A React component is not serializable across the server/client boundary, so
// the page hands over plain data keyed by `ProductKey` and this file owns the
// mark. That keeps every product's glyph in ONE table: sixteen cards drifting
// into sixteen palettes is what a catalogue does if you let each one carry its
// own drawing.
//
// THE TINT NO LONGER LIVES HERE (MESITA-2037). It is the product's FAMILY, and
// a family is shared with the mock console through
// `shared/product-families.ts` — the one record neither app may keep by hand,
// because a hue that drifts makes two consoles say two different things about
// what a product IS.
//
// The filter is why this is a client component at all. Three pills, one piece
// of state, no round trip — and "Not enabled" is the view an operator with a
// fresh place actually wants, because it is the to-do list.

import Link from "next/link";
import { useMemo, useState } from "react";
// THE ONLY LUCIDE LEFT IS THE STATE CHIP'S (MESITA-1952). Every product mark
// is an emoji in `MARK` below; check / dash / lock stay drawn glyphs, because
// state is a shape and a shape is what a chip can carry at 12px.
import { Check, Lock, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { familyStyle, SOON_PILL, SOON_TILE } from "@/lib/product-families";

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

/** THE MARK IS AN EMOJI NOW (MESITA-1952). Pato, at the catalogue: *"add
 *  fuckjing emojis or something"*.
 *
 *  MESITA-1934 took the tints away and made the GLYPH the whole of a product's
 *  identity; MESITA-1936 brought that here. What it left is a grid of grey
 *  squares holding grey marks — the tint table with its only job removed, on
 *  the screen where an operator spends money.
 *
 *  An emoji carries its own colour and costs the palette NOTHING: there is no
 *  hue to allocate, a sixteenth product cannot arrive to find the palette
 *  spent, and the wash stays the same muted square on every card — which is
 *  the property the tint table was kept for. The device is already this app's:
 *  `lib/business/strategies.ts` names the three reward strategies ⭕ 🌿 ⚡ and
 *  `PlaceTagsPicker` draws every facet with one.
 *
 *  THE STATE CHIP KEEPS ITS LUCIDE GLYPHS. State is a shape, not a hue
 *  (MESITA-1936) — check, dash, lock — and an emoji beside an emoji is two
 *  marks competing to be the card's identity.
 *
 *  ── THE TINT COLUMN IS GONE, AND THE TINT IS BACK (MESITA-2037) ──────────
 *
 *  This record was `{ mark, tint }` and every single `tint` read `bg-muted` —
 *  sixteen identical values, left standing after MESITA-1936 emptied the
 *  column of its only job. Pato, 2026-09-21: *"Give every Mesita product a
 *  background color based on its family."*
 *
 *  A TILE'S WASH IS ITS FAMILY'S NOW, and a family is not a property of this
 *  file. It is `shared/product-families.ts` — one record, generated into both
 *  consoles — because a hue kept by hand in two apps means two apps making two
 *  different claims about what a product IS, in colour, with every check
 *  green. So this record holds the mark and nothing else, which is all it has
 *  actually held since 1936. */
const MARK: Record<ProductKey, string> = {
  profile: "\u{1F3EA}",
  website: "\u{1F310}",
  customers: "\u{1F465}",
  ads: "\u{1F4E3}",
  visits: "\u{1F39F}\u{FE0F}",
  rewards: "\u{1F381}",
  orders: "\u{1F6CD}\u{FE0F}",
  reservations: "\u{1F4C5}",
  pay: "\u{1F4B3}",
  // ONE MARK PER CARD, THE RULE THE GLYPH TABLE ALREADY LIVED BY. Terminal is
  // the TAP and POS is what was rung up before anybody tapped — 📲 and 🧾,
  // never a second 💳, because one mark on two cards in the same grid is how
  // an operator learns to distrust both drawings.
  terminal: "\u{1F4F2}",
  pos: "\u{1F9FE}",
  // A COIN, NOT A WALLET: Pay › Wallet is the guest's; credits are a balance
  // the place sold.
  credits: "\u{1FA99}",
  // The BANK'S FRONT, the same mark the landing page gives Capital
  // (MESITA-1929).
  capital: "\u{1F3E6}",
  // NOT A HANDSET AND NOT A CHAT BUBBLE (MESITA-1951): either one would make
  // the card look like one channel's product again, which is the whole thing
  // the merge undid. 🤖 is what the name now says out loud.
  line: "\u{1F916}",
  intelligence: "\u{2728}",
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
  free: "bg-foreground text-paper",
  enabled: "bg-foreground text-paper",
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

/** A TILE WEARS ITS FAMILY (MESITA-2037).
 *
 *  THREE THINGS CARRY THE HUE. The tile's fill is the family tint, the plate
 *  behind the mark is that tint one step stronger, and the NAME is the family
 *  ink. Everything else stays exactly as achromatic as MESITA-1936 left it:
 *  the blurb, the note, the state chip and the action button.
 *
 *  THE NAME TAKES THE INK, NEVER THE BASE HUE. Four of the six families FAIL
 *  WCAG AA as text on this card — loyalty is 2.48:1 — so the base paints only
 *  the plate, the wash and the focus ring, where 3:1 is the bar. See
 *  `shared/product-families.ts`, which carries both numbers and the reasoning.
 *
 *  THE STATE CHIP IS STILL A SHAPE (MESITA-1936). Check, dash, lock, dashed —
 *  and a Soon tile now says so twice over: the dashed border it already drew,
 *  plus a pill, on a card that is otherwise carrying colour and would read as
 *  live without one. Soon KEEPS its family tint and steps the whole tile back
 *  instead, because a colourless tile in a coloured grid reads as "belongs to
 *  no family" rather than "not built yet". It has no action to click, which is
 *  what makes it not clickable — there is nothing to disable.
 *
 *  HOVER AND FOCUS ARE THE ACTION'S, not the tile's. This is an `li`, and the
 *  only thing an operator can actually press is the verb at the bottom: it
 *  takes the family's focus ring, and the TILE takes the stronger tint on
 *  hover, so the whole card answers a pointer that is aimed at its button. */
function ProductTile({ product }: { product: ProductCard }) {
  const mark = MARK[product.key];
  const family = familyStyle(product.key);
  const soon = product.state === "soon";
  return (
    <li
      className={cn(
        // Section's geometry (rounded-2xl, border, card) so a product tile and
        // a console box are visibly the same shape. What differs is the LIFT:
        // a live product lifts, a Soon one lies flat — the rank-by-depth rule
        // SoonStrip.tsx wrote, applied to a grid.
        "border-border flex min-w-0 flex-col gap-3 rounded-2xl border p-4 transition",
        family.tint,
        soon
          ? `border-dashed ${SOON_TILE}`
          : `shadow-card hover:border-foreground/20 ${family.hover}`,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          family.tintStrong,
        )}
      >
        {/* `leading-none` because an emoji's line box is taller than its
            glyph: without it the mark sits low in its own square. */}
        <span className="text-[22px] leading-none">{mark}</span>
      </span>

      <div className="flex min-w-0 flex-col gap-1">
        <h3
          className={cn(
            "font-display text-sm font-semibold tracking-tight",
            family.ink,
          )}
        >
          {product.name}
        </h3>
        <p className="text-muted-foreground text-[12px] leading-snug">
          {product.blurb}
        </p>
      </div>

      {/* THE CHIP FOLLOWS THE BLURB; ONLY THE VERB IS PINNED.
          Bottom-aligning the whole block was the obvious move and it is the
          wrong one: Physical Terminal has no verb, so its block is a row
          shorter, and its Soon chip floated ~20px BELOW every other card's
          chip in the same grid row. One tile out of line reads as a bug, not
          as a difference. `mt-auto` on the action alone puts every button on
          one baseline and lets the chips align with each other. */}
      <div className="flex flex-col gap-2">
        {soon ? <span className={SOON_PILL}>Soon</span> : <StateChip state={product.state} />}
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
            "mt-auto inline-flex h-9 w-full items-center justify-center rounded-xl text-[12px] font-semibold transition",
            // THE RING IS THE FAMILY'S (MESITA-2037). It used to be
            // `focus-visible:ring-foreground/30`, which is the achromatic
            // default and is the one thing on this tile a keyboard user
            // navigates BY — on a grid of sixteen it now says which product
            // they are standing on, not just that they are standing somewhere.
            family.focus,
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
