// One badge per FACT, and never two badges for one fact.
//
// THE FACT ROW IS GONE, AND THE RULE OUTLIVED IT (MESITA-1943). `PlaceFacts`
// stood in `PlaceHeading` and put Verified and Partner on top of every place
// view. The heading went because the rail already said the name, the photo and
// the open view; the two facts went with it because they now read where they
// are EXPLAINED rather than merely asserted:
//
//   Verified · Partner → Settings › States, one row each, with the sentence
//     that says what the fact means and who sets it (MESITA-1941). A badge
//     could only ever say "yes".
//   Partner, on the catalogue → `PartnerBanner`, beside the membership it is
//     the status OF. That screen exists to explain the gate; stating the gate
//     there is the one place it is not an echo.
//
// It also removes the trap that made the dark-header proposal expensive:
// `tone="on"` is `bg-foreground`, so a fact badge rendered on an ink surface
// was 1.00:1 against its own ground and `gold` fell from 7.8:1 to 1.4:1. Every
// tone below assumes a WHITE card. Painting one on `--dock` needs a variant
// here first, not a wrapper around the caller — `soonDock` is the first one
// that was actually needed (MESITA-2013), and the note beside `TONES` says
// why it is the only tone so far that could not survive the rail as it was.
//
// PROMOTING LEFT FIRST (MESITA-1925). Pato: *"remove the promothing shit"*. It
// is a per-request computation (strategy ≠ zero AND an open promo lane) that
// can flip false under a paid partner with no write at all, so beside two
// badges that only move when somebody acts it read as a third of the same kind
// — and the product calls that fact "Rewards", never Promoting.
//
// TWO REGISTERS, ON PURPOSE (MESITA-2035). The console card is Member Visits
// and its dial is Rewards; the STATES matrix still labels the `promoting`
// wire key "Visit Rewards" in `shared/state-vocabulary.ts`, which is
// generated, mirrored into web-admin and web-business, and pinned word for
// word to Notion Main §11.2. That label names a place's CONDITION, not this
// card, so it did not move with the rename — same standing exception that
// keeps "Mesita Credits" and "Mesita Pay" in that file.
// `promoting` stays on `MockPlace`, and stays a column in the `/places` states
// matrix and a row in AdminView: those screens exist to list every state,
// which is the point of this app.
import { cn } from "@/lib/utils";
import type { ProductState } from "@/lib/products";

const BASE =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap";

// STATE IS A SHAPE, NOT A GREY (MESITA-1934).
//
// These tones used to be hues: On and Free were emerald, Off was grey, Soon was
// amber. Send all three to greyscale and On, Off, Free and Soon become ONE chip
// — on the catalogue screen whose entire job is saying which products are on.
// The place facts lost the same way: Verified and Unverified were one object.
//
// So the axis is FILL / OUTLINE / DASHED, which survives greyscale, print, and a
// colourblind operator, and which this app already speaks: SoonStrip and
// EmptyState are both `border-dashed`, so dashed already means "not here yet"
// here. Three greys at 11px would have been the weakest axis available.
//
// `gold` and `bad` are the two RESERVED signals and keep their chroma: a tier
// the product names out loud, and the one thing that says "this destroys
// something".
//
// `live` IS THE THIRD, AND IT SITS ON TOP OF THE SHAPE AXIS (MESITA-2001).
// Pato, on the Setup index: *"add maybe a color to the list to indicate if
// Inactive or Active or whatever"*. It is a FILLED chip like `on` was, tinted
// green instead of ink — so the axis above is untouched: filled still means
// in force, outline still means off, dashed still means not here yet, and the
// hue is a second channel carrying the same fact rather than a replacement
// for the first. Strip the colour and this file still works, which is the
// test the original note set and the reason the change is cheap.
//
// IT IS A NEW TONE RATHER THAN A REPAINT OF `on`. `on` is the generic yes —
// AdminView, OrdersView, Settings and the catalogue all reach for it for facts
// that are not a product's state. Tinting it green would have turned every
// "yes" in the app into a running product.
// `soonDock` IS THE VARIANT THE NOTE AT THE TOP OF THIS FILE ASKED FOR
// (MESITA-2013). It said every tone here assumes a white card and that painting
// one on `--dock` needs a variant, not a wrapper around the caller. This is it.
//
// `soon` WAS NOT THE ONLY ONE THAT NEEDED IT (MESITA-2034, corrected). The
// note used to claim `live` and `gold` are tinted fills that "survive the ink
// rail unchanged" — that was asserted, not measured. Computed from the real
// oklch tokens: `live`'s tint on `--dock` is ~1.3–1.8:1 depending on the
// fixture, `gold`'s is 1.40:1. Both fail AA, and `live` is the badge on most
// product rows in the default preset — the single most-seen sidebar badge was
// unreadable. `off` (no fill, `--quiet` text) was never broken; it was simply
// never given a dock variant either, so it is added here for completeness.
//
// THE FIX IS THE SAME MOVE `on` ALREADY MAKES (`text-paper` on `bg-foreground`):
// the WORD goes to `--dock-foreground` (near-white) and the FILL carries the
// hue at enough opacity to stay a visible, on-brand tint. Computed:
// `--state-live`/28 + `--dock-foreground` text = 11.32:1 on `--dock`;
// `--tier-gold`/28 + `--dock-foreground` = 8.57:1. Both comfortably clear
// 4.5:1 — verified by direct oklch→sRGB→WCAG computation, not eyeballed (an
// earlier draft of this fix used colour-matched text at /22 opacity, which
// computes to 3.4–3.9:1 and fails).
//
// THE SHAPE AXIS IS UNTOUCHED everywhere: filled still means in force,
// outline still means off, dashed still means not here yet. Only the word's
// colour changes on the three filled/outline dock tones, and only because the
// surface behind them is dark instead of white.
const TONES: Record<string, string> = {
  on: "bg-foreground text-paper",
  live: "bg-[color:var(--state-live)]/18 text-[color:var(--state-live-ink)]",
  liveDock: "bg-[color:var(--state-live)]/28 text-dock-foreground",
  off: "border-border text-muted-foreground border",
  offDock: "border-dock-border text-dock-muted border",
  soon: "border-border text-muted-foreground border border-dashed",
  soonDock: "border-dock-border text-dock-muted border border-dashed",
  neutral: "bg-muted text-muted-foreground",
  neutralDock: "bg-dock-surface text-dock-foreground",
  gold: "bg-[color:var(--tier-gold)]/18 text-[color:var(--tier-gold-ink)]",
  goldDock: "bg-[color:var(--tier-gold)]/28 text-dock-foreground",
  bad: "bg-destructive/10 text-destructive",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?:
    | "neutral"
    | "neutralDock"
    | "on"
    | "live"
    | "liveDock"
    | "off"
    | "offDock"
    | "soon"
    | "soonDock"
    | "gold"
    | "goldDock"
    | "bad";
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn(BASE, TONES[tone], className)}>{children}</span>;
}

// FREE AND ENABLED ARE ONE FACT — the product is RUNNING — and they take the
// live tint together. Free is not a lesser On: it is a product this place has,
// working, on the rung it came with. The WORD still tells them apart, which is
// the whole reason the hue is allowed to collapse them.
const PRODUCT_TONE: Record<ProductState, "live" | "off" | "soon" | "gold"> = {
  free: "live",
  enabled: "live",
  off: "off",
  locked: "gold",
  soon: "soon",
};

const PRODUCT_WORD: Record<ProductState, string> = {
  free: "Free",
  enabled: "On",
  off: "Off",
  locked: "Locked",
  soon: "Soon",
};

const DOCK_TONE: Record<"live" | "off" | "soon" | "gold", "liveDock" | "offDock" | "soonDock" | "goldDock"> = {
  live: "liveDock",
  off: "offDock",
  soon: "soonDock",
  gold: "goldDock",
};

/** `onDock` says the badge is being drawn on the ink menu rather than a white
 *  card. It is the CALLER's fact — only the caller knows its own ground — and
 *  it selects a tone rather than restyling one, which is the line the note
 *  above `TONES` draws. ALL FOUR states move now (MESITA-2034) — `live` and
 *  `off`, not only `gold`/`soon`, measured unreadable on `--dock`; see the
 *  note above `TONES`. */
export function ProductStateBadge({
  state,
  onDock = false,
}: {
  state: ProductState;
  onDock?: boolean;
}) {
  const tone = PRODUCT_TONE[state];
  return (
    <Badge tone={onDock ? DOCK_TONE[tone] : tone}>{PRODUCT_WORD[state]}</Badge>
  );
}
