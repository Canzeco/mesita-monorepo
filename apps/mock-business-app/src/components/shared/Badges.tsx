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

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "good" | "warn" | "bad" | "brand" | "gold";
  children: React.ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-muted text-muted-foreground",
    good: "bg-emerald-500/12 text-emerald-700",
    warn: "bg-amber-500/15 text-amber-700",
    bad: "bg-destructive/10 text-destructive",
    brand: "bg-primary/12 text-[color:var(--brand-pink-text)]",
    gold: "bg-[color:var(--tier-gold)]/18 text-amber-800",
  };
  return <span className={cn(BASE, tones[tone], className)}>{children}</span>;
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
      {verified && <Badge tone="good">Verified</Badge>}
      {partnered && <Badge tone="gold">Partner</Badge>}
      {!verified && !partnered && <Badge>Unverified</Badge>}
    </div>
  );
}

const PRODUCT_TONE: Record<ProductState, "good" | "neutral" | "warn" | "gold"> = {
  free: "good",
  enabled: "good",
  off: "neutral",
  locked: "gold",
  soon: "warn",
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
