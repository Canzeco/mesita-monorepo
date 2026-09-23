// THE SIX FAMILIES — what a product is FOR, as one colour.
//
// Pato, 2026-09-21: *"Give every Mesita product a background color based on
// its family."* Six families, in his order, each with one hue; a product's
// tile wears that hue as a soft tint and its name in the family's ink.
//
// ── WHY THIS FILE IS SHARED AND NOT COPIED ────────────────────────────────
//
// `product-keys.ts` exists twice — canonical in `web-business`, hand-snapshot
// in `web-business` — and the snapshot is what a rename is typed into
// second, when it is typed at all. web-business is four labels stale right now
// (Host, Market Intelligence, Guest Catalog, Point of Sale) for exactly that
// reason. A COLOUR is worse than a label to keep by hand: two consoles showing
// one product in two hues is not a typo an operator can read past, it is two
// different claims about what the product IS.
//
// So this is a `shared/` source and `scripts/sync-shared.ts` writes the copies.
// The mock is a sync target for the first time here — it had never been one,
// because until now nothing it owned was policy both consoles had to agree on.
//
// ── THE KEY UNION IS THE SUPERSET, DELIBERATELY ───────────────────────────
//
// The two apps do not have the same `ProductKey`. The mock has twenty (it
// leads: `partner`, `menu`, `tableorders`, `orderpad`, `access`); web-business
// has fourteen. It used to carry `rewards` as well, and MESITA-2035 finished
// the merge the mock made at MESITA-1953, so that key is gone from BOTH unions
// now — the one difference this header was written around. The unions still
// differ by the five above. A shared record cannot be typed `Record<ProductKey,
// …>` against either union without breaking the other, so it is keyed by the
// UNION and each app asserts its own subset in its own test. That assertion is
// the gate: a twenty-first product with no family fails `pnpm test` in the app
// that added it, rather than rendering a colourless tile nobody notices.
//
// ── WHAT THE HUE MAY AND MAY NOT PAINT ────────────────────────────────────
//
// THE SOLID COLOUR IS NOT TEXT. Measured on white — the card's own fill —
// four of the six FAIL WCAG AA for body text: Loyalty #F08C00 is 2.48:1,
// Money #22A559 is 3.18:1, Presence #E23D69 is 4.11:1, Insights #0B8A92 is
// 4.15:1. Only Operations (4.57) and Automation (4.95) clear 4.5.
//
// So each family has TWO values. The HUE paints the tint and the mark's
// plate: large fills behind a glyph, which carry no contrast requirement at
// all. The INK is that hue with its lightness moved until it clears 5:1 — down
// against the white card, up against the dark one — and it is what a product's
// NAME is written in. This is the `--tier-gold` / `--tier-gold-ink` pair that
// already lives in both stylesheets, applied six times.
//
// THE FOCUS RING TAKES THE INK TOO, and that is not obvious. A ring reads as
// "the hue", so the base was the natural pick — but a ring is a UI COMPONENT
// BOUNDARY and WCAG 1.4.11 asks 3:1 of it, which loyalty (2.48:1) fails
// outright and money (3.18:1) clears by a hair. The ring is the one mark a
// keyboard user navigates BY; it is worth nothing if they cannot see it.
//
// BODY COPY NEVER TAKES THE INK. A blurb is `text-muted-foreground` on every
// tile exactly as it was; the family says which product this is, not which
// sentence to read.
//
// ── THE TINT IS A TOKEN, NEVER AN OPACITY ─────────────────────────────────
//
// `bg-[#E23D69]/11` would composite against whatever happens to be behind the
// tile, which on the catalogue is the card and on the rail is the dock's ink.
// The tokens are `color-mix`ed against `--card` in the stylesheet instead, so
// the tint is a real colour with a known contrast and the dark block moves the
// mix rather than the alpha. Plans (Free, Pro, Ultra) get NO family colour —
// a rung is not a family, and a coloured plan chip beside a coloured product
// tile is two palettes arguing on one card.

/** The six, in Pato's order. The catalogue's band order is `PRODUCT_BANDS`
 *  and it is NOT this: bands group by what an operator is shopping for, and a
 *  family groups by what the product does. They disagree, on purpose. */
export const FAMILY_KEYS = [
  "presence",
  "operations",
  "money",
  "loyalty",
  "automation",
  "insights",
] as const;

export type FamilyKey = (typeof FAMILY_KEYS)[number];

/** What each family is called and what it is made of.
 *
 *  `color` is the hue as Pato dictated it, unaltered — it is the token's value
 *  and the thing a designer checks against. `ink` and `inkDark` are DERIVED
 *  from it (same hue, same chroma, lightness moved until AA clears) and are
 *  recorded here so the stylesheet is not the only place the number exists. */
export const FAMILY: Record<
  FamilyKey,
  { label: string; color: string; ink: string; inkDark: string }
> = {
  presence: {
    label: "Presence",
    color: "#E23D69",
    ink: "#D12A5C",
    inkDark: "#FE5980",
  },
  operations: {
    label: "Operations",
    color: "#2F6FEB",
    ink: "#2968E4",
    inkDark: "#5093FF",
  },
  money: {
    label: "Money",
    color: "#22A559",
    ink: "#008138",
    inkDark: "#29AA5D",
  },
  loyalty: {
    label: "Loyalty",
    color: "#F08C00",
    ink: "#B35400",
    inkDark: "#F08C00",
  },
  automation: {
    label: "Automation",
    color: "#9146E8",
    ink: "#9045E7",
    inkDark: "#B973FF",
  },
  insights: {
    label: "Insights",
    color: "#0B8A92",
    ink: "#007B84",
    inkDark: "#36A3AA",
  },
};

/** Every product key either console knows, and the family it belongs to.
 *
 *  FOURTEEN CAME FROM PATO'S LIST. The other seven are placed here and the
 *  reason is written beside each, because a family assignment nobody argued
 *  for is the kind of thing a later reader "fixes":
 *
 *    ads         Presence — paid reach is still the world seeing you, and
 *                Insights is the reading of results, not the buying of them.
 *    tableorders Operations — the same order as `orders`, placed at the table.
 *    orderpad    Operations — it TAKES an order; the till it syncs to is
 *                Money's, the taking is not.
 *    pos         Money — the till. It sits beside Digital Terminal in the
 *                catalogue for the same reason it sits beside it here.
 *    capital     Money — it is the advance.
 *    menu        Presence — Pato's list puts it there, and MESITA-2026's
 *                reframe agrees: the scan is a guest surface, not an input.
 *
 *  This is a plain `Record<string, …>` on purpose. See the header: neither
 *  app's `ProductKey` union is the whole list, and each app's own test is what
 *  proves its union is covered. */
export const PRODUCT_FAMILY: Record<string, FamilyKey> = {
  // Presence — who you are, and what the world reads back.
  profile: "presence",
  reviews: "presence",
  menu: "presence",
  website: "presence",
  partner: "presence",
  ads: "presence",

  // Operations — the guest being served.
  orders: "operations",
  reservations: "operations",
  tableorders: "operations",
  orderpad: "operations",

  // Money — what is charged, and what is advanced.
  pay: "money",
  terminal: "money",
  pos: "money",
  capital: "money",

  // Loyalty — what brings the guest back.
  // `rewards` LEFT THIS MAP (MESITA-2035). It was here for one reason — that
  // web-business had not ported MESITA-1953's merge — and it has now; there is
  // no `rewards` ProductKey in either app, so an entry for it would be a
  // colour for a card that does not exist.
  visits: "loyalty",
  credits: "loyalty",

  // Automation — the work nobody is doing.
  line: "automation",
  access: "automation",

  // Insights — the reading of all of it.
  customers: "insights",
  intelligence: "insights",
};

/** The family a product belongs to. Falls back to Presence rather than
 *  throwing: a console that lost a key should render the wrong tint, not a
 *  blank screen — and the per-app test is what stops it reaching production. */
export function familyOf(key: string): FamilyKey {
  return PRODUCT_FAMILY[key] ?? "presence";
}

/** THE CLASS STRINGS ARE WRITTEN OUT, ONE SET PER FAMILY, AND THAT IS NOT
 *  BOILERPLATE — it is the only shape Tailwind can see.
 *
 *  Tailwind v4 scans source text for class names. `bg-family-${family}-tint`
 *  is a template literal, which the scanner cannot resolve, so the utility is
 *  never generated and the class is DROPPED SILENTLY — it compiles, deploys
 *  and renders a plain white tile. (globals.css carries the same warning about
 *  `bg-brand/10`.) Six literal records is what makes the tint exist.
 *
 *  The names resolve through `@theme inline` in each app's globals.css:
 *  `--color-family-presence-tint` → `bg-family-presence-tint`. */
export type FamilyStyle = {
  /** The item background. */
  tint: string;
  /** The item background one step stronger — hover, and the mark's square. */
  tintStrong: string;
  /** The product NAME. AA-safe; nothing else may use it. */
  ink: string;
  /** The icon/mark glyph, and any hairline the family owns. */
  accent: string;
  /** A visible focus ring in the family colour — the INK, not the base hue.
   *
   *  A RING IS A UI COMPONENT BOUNDARY, so WCAG 1.4.11 asks 3:1 of it against
   *  the card, and the base hue does not clear that: loyalty #F08C00 measures
   *  2.48:1 on white and money #22A559 is 3.18:1, a hair over. The ink clears
   *  5:1 by construction and is still unmistakably the family's colour — the
   *  ring is the one mark on a tile a keyboard user navigates BY, and it is
   *  worth nothing at all if they cannot see it. The base keeps the jobs with
   *  no contrast requirement: the wash and the plate, which are large fills
   *  behind a glyph, not boundaries carrying meaning. */
  focus: string;
  /** Hover: a slightly stronger tint, on a tile that is a link. */
  hover: string;
};

export const FAMILY_STYLE: Record<FamilyKey, FamilyStyle> = {
  presence: {
    tint: "bg-family-presence-tint",
    tintStrong: "bg-family-presence-tint-strong",
    ink: "text-family-presence-ink",
    accent: "text-family-presence",
    focus:
      "outline-none focus-visible:ring-2 focus-visible:ring-family-presence-ink focus-visible:ring-offset-2 focus-visible:ring-offset-card",
    hover: "hover:bg-family-presence-tint-strong",
  },
  operations: {
    tint: "bg-family-operations-tint",
    tintStrong: "bg-family-operations-tint-strong",
    ink: "text-family-operations-ink",
    accent: "text-family-operations",
    focus:
      "outline-none focus-visible:ring-2 focus-visible:ring-family-operations-ink focus-visible:ring-offset-2 focus-visible:ring-offset-card",
    hover: "hover:bg-family-operations-tint-strong",
  },
  money: {
    tint: "bg-family-money-tint",
    tintStrong: "bg-family-money-tint-strong",
    ink: "text-family-money-ink",
    accent: "text-family-money",
    focus:
      "outline-none focus-visible:ring-2 focus-visible:ring-family-money-ink focus-visible:ring-offset-2 focus-visible:ring-offset-card",
    hover: "hover:bg-family-money-tint-strong",
  },
  loyalty: {
    tint: "bg-family-loyalty-tint",
    tintStrong: "bg-family-loyalty-tint-strong",
    ink: "text-family-loyalty-ink",
    accent: "text-family-loyalty",
    focus:
      "outline-none focus-visible:ring-2 focus-visible:ring-family-loyalty-ink focus-visible:ring-offset-2 focus-visible:ring-offset-card",
    hover: "hover:bg-family-loyalty-tint-strong",
  },
  automation: {
    tint: "bg-family-automation-tint",
    tintStrong: "bg-family-automation-tint-strong",
    ink: "text-family-automation-ink",
    accent: "text-family-automation",
    focus:
      "outline-none focus-visible:ring-2 focus-visible:ring-family-automation-ink focus-visible:ring-offset-2 focus-visible:ring-offset-card",
    hover: "hover:bg-family-automation-tint-strong",
  },
  insights: {
    tint: "bg-family-insights-tint",
    tintStrong: "bg-family-insights-tint-strong",
    ink: "text-family-insights-ink",
    accent: "text-family-insights",
    focus:
      "outline-none focus-visible:ring-2 focus-visible:ring-family-insights-ink focus-visible:ring-offset-2 focus-visible:ring-offset-card",
    hover: "hover:bg-family-insights-tint-strong",
  },
};

/** The style set for a product, by key. The one call every render site makes. */
export function familyStyle(key: string): FamilyStyle {
  return FAMILY_STYLE[familyOf(key)];
}

/** What a Soon product's tile wears ON TOP of its family tint.
 *
 *  Pato: *"same family tint, reduced opacity, a small 'Soon' pill, and not
 *  clickable"*. The tint stays — an unbuilt product still belongs to its
 *  family, and dropping the colour would make Soon read as "no family" — and
 *  the whole tile steps back instead. It pairs with the dashed border both
 *  catalogues already draw for Soon, which is this codebase's spelling of
 *  "not here yet". */
export const SOON_TILE = "opacity-65";

/** The Soon pill. NEUTRAL, not the family's hue: the family says what the
 *  product is and the pill says whether it exists, and a hue doing both jobs
 *  is the failure MESITA-1936 wrote down — state is a shape, never a colour. */
export const SOON_PILL =
  "inline-flex w-fit items-center rounded-full border border-dashed border-border px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase";
