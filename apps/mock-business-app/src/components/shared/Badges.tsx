// One badge per FACT, and never two badges for one fact.
//
// Mesita's three place facts are three, not one: Verified (Mesita checked the
// place is real), Partner (it pays), Promoting (it is buying reach). They are
// independent — a verified place need not be a partner, and `isPartner` is the
// one that gates what a place may switch on.
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
  promoting,
}: {
  verified: boolean;
  partnered: boolean;
  promoting: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {verified && <Badge tone="good">Verified</Badge>}
      {partnered && <Badge tone="gold">Partner</Badge>}
      {promoting && <Badge tone="brand">Promoting</Badge>}
      {!verified && !partnered && !promoting && <Badge>Unverified</Badge>}
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
