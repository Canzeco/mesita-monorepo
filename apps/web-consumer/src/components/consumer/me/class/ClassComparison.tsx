import { CLASSES, CLASS_ICONS, classBadgeClass } from "@/lib/consumer-data";
import { baseRateForClass } from "@/lib/reward-segments";
import { cn } from "@/lib/utils";
import type { ConsumerClass } from "@/lib/mock/place";

// Four-class comparison (segments v6) — Standard / Premium / Influencer /
// Aura in ladder order. Four columns no longer fit a phone-width grid, so the
// comparison is a stacked list: one compact row-card per class with the three
// separating facts (door, base discount, reservations). The elevated classes
// share the recommendation/reservation perks by design; the door and the way
// the money is made are what differ.

const ROWS: {
  key: ConsumerClass;
  door: string;
  discount: string;
  reservations: string;
  tint: string;
  text: string;
}[] = [
  {
    key: "standard",
    door: "Free",
    discount: `Up to ${baseRateForClass("standard")}% base`,
    reservations: "2",
    tint: "bg-muted/50",
    text: "text-foreground/80",
  },
  {
    key: "premium",
    door: "$100/mo",
    discount: `Up to ${baseRateForClass("premium")}% base`,
    reservations: "10",
    tint: "bg-tier-premium/[0.07]",
    text: "text-premium",
  },
  {
    key: "influencer",
    door: "1,000+ IG followers",
    discount: `Up to ${baseRateForClass("influencer")}% + Story bonus`,
    reservations: "10",
    tint: "bg-sky-500/10",
    text: "text-sky-700",
  },
  {
    key: "aura",
    door: "By invitation",
    discount: `Up to ${baseRateForClass("aura")}% base — highest`,
    reservations: "10",
    tint: "bg-amber-400/15",
    text: "text-amber-700",
  },
];

export function ClassComparison() {
  return (
    <div className="flex flex-col gap-2">
      {ROWS.map((row) => {
        const cls = CLASSES.find((c) => c.id === row.key)!;
        const Icon = CLASS_ICONS[row.key];
        return (
          <div
            key={row.key}
            className={cn(
              "border-border/60 flex items-center gap-3 rounded-2xl border px-3 py-2.5",
              row.tint,
            )}
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-xl",
                classBadgeClass(row.key),
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "font-display text-[13px] font-bold tracking-tight",
                    row.text,
                  )}
                >
                  {cls.label}
                </span>
                <span className="text-muted-foreground text-[11px] font-medium">
                  {row.door}
                </span>
              </p>
              <p className="text-muted-foreground truncate text-[11.5px] leading-snug">
                {row.discount} · {row.reservations} reservations/mo
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
