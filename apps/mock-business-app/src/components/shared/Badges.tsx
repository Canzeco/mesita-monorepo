// One badge per FACT, and never two badges for one fact.
//
// TWO IN THE HEADING, NOT THREE (MESITA-1925). Pato: *"remove the promothing
// shit"*. Verified (Mesita checked the place is real) and Partner (it pays)
// are independent, and `isPartner` is the one that gates what a place may
// switch on — the Membership banner under this heading says so in words.
//
// PROMOTING LEFT, and the badge row is the only place it left from. It is a
// per-request computation (strategy ≠ zero AND an open promo lane) that can
// flip false under a paid partner with no write at all, so beside two badges
// that only move when somebody acts it read as a third of the same kind. The
// real console never had this row (`web-business`'s `PlaceHeading` renders no
// facts beside the name) and where it does name that fact it calls it "Visit
// Rewards", not Promoting — so this badge was teaching a word the product
// does not use. `promoting` stays on `MockPlace`, and stays a column in the
// `/places` states matrix and a row in AdminView: those screens exist to list
// every state, which is the point of this app.
import { cn } from "@/lib/utils";
import type { ProductState } from "@/lib/products";

const BASE =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap";

// STATE IS A SHAPE, NOT A GREY (MESITA-1934).
//
// These tones used to be hues: On and Free were emerald, Off was grey, Soon was
// amber. Send all three to greyscale and On, Off, Free and Soon become ONE chip
// — on the catalogue screen whose entire job is saying which products are on.
// PlaceFacts lost the same way: Verified and Unverified were the same object.
//
// So the axis is FILL / OUTLINE / DASHED, which survives greyscale, print, and a
// colourblind operator, and which this app already speaks: SoonStrip and
// EmptyState are both `border-dashed`, so dashed already means "not here yet"
// here. Three greys at 11px would have been the weakest axis available.
//
// `gold` and `bad` are the two RESERVED signals and keep their chroma: a tier
// the product names out loud, and the one thing that says "this destroys
// something".
const TONES: Record<string, string> = {
  on: "bg-foreground text-background",
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
  tone?: "neutral" | "on" | "off" | "soon" | "gold" | "bad";
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn(BASE, TONES[tone], className)}>{children}</span>;
}

export function PlaceFacts({
  verified,
  partnered,
}: {
  verified: boolean;
  partnered: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {verified && <Badge tone="on">Verified</Badge>}
      {partnered && <Badge tone="gold">Partner</Badge>}
      {!verified && !partnered && <Badge tone="off">Unverified</Badge>}
    </div>
  );
}

const PRODUCT_TONE: Record<ProductState, "on" | "off" | "soon" | "gold"> = {
  free: "on",
  enabled: "on",
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
