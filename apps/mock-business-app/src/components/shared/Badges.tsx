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
// here first, not a wrapper around the caller.
//
// PROMOTING LEFT FIRST (MESITA-1925). Pato: *"remove the promothing shit"*. It
// is a per-request computation (strategy ≠ zero AND an open promo lane) that
// can flip false under a paid partner with no write at all, so beside two
// badges that only move when somebody acts it read as a third of the same kind
// — and the product calls that fact "Visit Rewards", never Promoting.
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
const TONES: Record<string, string> = {
  on: "bg-foreground text-paper",
  live: "bg-[color:var(--state-live)]/18 text-[color:var(--state-live-ink)]",
  off: "border-border text-muted-foreground border",
  soon: "border-border text-muted-foreground border border-dashed",
  neutral: "bg-muted text-muted-foreground",
  gold: "bg-[color:var(--tier-gold)]/18 text-[color:var(--tier-gold-ink)]",
  bad: "bg-destructive/10 text-destructive",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "on" | "live" | "off" | "soon" | "gold" | "bad";
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

export function ProductStateBadge({ state }: { state: ProductState }) {
  return <Badge tone={PRODUCT_TONE[state]}>{PRODUCT_WORD[state]}</Badge>;
}
