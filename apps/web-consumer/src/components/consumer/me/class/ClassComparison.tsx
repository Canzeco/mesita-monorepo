import { CLASS_ICONS, classBadgeClass } from "@/lib/consumer-data";
import { baseRateForClass } from "@/lib/reward-segments";
import { cn } from "@/lib/utils";
import type { ConsumerClass } from "@/lib/mock/place";

// Four-class comparison (segments v6) — a 5-column perk table, simplified to
// the three actual perks (Pato, 2026-08-04): Discount Rewards, Places
// Recommendations, AI-Booked Reservations. One label column + Standard /
// Influencer / Premium / Aura in rate-ladder order (25/30/35/40 — the
// discount row reads ascending left to right). Cells stay tiny (10–12px,
// tabular) so the full table fits a phone width; each class column carries
// its identity tint end to end (sky / violet / gold). Values derive from
// reward-segments so the table can never drift from the grid the bill
// engine reads.

const COLS: {
  key: ConsumerClass;
  label: string;
  door: string;
  text: string;
  tint: string;
}[] = [
  {
    key: "standard",
    label: "Standard",
    door: "Free",
    text: "text-foreground/80",
    tint: "bg-muted/40",
  },
  {
    key: "influencer",
    label: "Influencer",
    door: "1K+ IG",
    text: "text-sky-700",
    tint: "bg-sky-500/10",
  },
  {
    key: "premium",
    label: "Premium",
    door: "$100/mo",
    text: "text-premium",
    tint: "bg-tier-premium/[0.07]",
  },
  {
    key: "aura",
    label: "Aura",
    door: "Invite",
    text: "text-amber-700",
    tint: "bg-amber-400/15",
  },
];

// The three perks, in Pato's canonical order. `values` align with COLS.
const ROWS: { label: string; values: string[] }[] = [
  {
    label: "Discount Rewards",
    values: COLS.map((c) => `${baseRateForClass(c.key)}%`),
  },
  {
    label: "Places Recommendations",
    values: ["Basic", "Better", "Better", "Better"],
  },
  {
    label: "AI-Booked Reservations",
    values: ["2/mo", "10/mo", "10/mo", "10/mo"],
  },
];

const GRID_COLS = "grid-cols-[minmax(0,1.15fr)_repeat(4,minmax(0,0.82fr))]";

export function ClassComparison() {
  return (
    <div className="border-border bg-card overflow-hidden rounded-2xl border px-2 py-2">
      {/* Header — the four classes, each with its door. */}
      <div className={cn("grid items-end gap-x-1", GRID_COLS)}>
        <span />
        {COLS.map((col) => {
          const Icon = CLASS_ICONS[col.key];
          return (
            <div
              key={col.key}
              className={cn(
                "flex flex-col items-center gap-1 rounded-t-lg px-0.5 pt-2 pb-1.5",
                col.tint,
              )}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-md",
                  classBadgeClass(col.key),
                )}
              >
                <Icon className="h-3 w-3" />
              </span>
              <span
                className={cn(
                  "font-display max-w-full truncate text-[10.5px] leading-none font-bold tracking-tight",
                  col.text,
                )}
              >
                {col.label}
              </span>
              <span className="text-muted-foreground max-w-full truncate text-[9px] leading-none font-medium">
                {col.door}
              </span>
            </div>
          );
        })}
      </div>

      {/* Perk rows. */}
      {ROWS.map((row, ri) => {
        const last = ri === ROWS.length - 1;
        return (
          <div
            key={row.label}
            className={cn("grid items-stretch gap-x-1", GRID_COLS)}
          >
            <span
              className={cn(
                "text-foreground/80 flex items-center pl-1.5 text-[11px] leading-tight font-medium",
                ri > 0 && "border-border/50 border-t",
              )}
            >
              {row.label}
            </span>
            {row.values.map((v, ci) => (
              <span
                key={COLS[ci].key}
                className={cn(
                  "flex min-h-9 items-center justify-center px-0.5 text-center text-[11px] leading-tight font-semibold tabular-nums",
                  COLS[ci].tint,
                  COLS[ci].text,
                  last && "rounded-b-lg",
                )}
              >
                {v}
              </span>
            ))}
          </div>
        );
      })}

      <p className="text-muted-foreground/80 px-1.5 pt-2 pb-0.5 text-[10px] leading-snug">
        Rates are the top of each range — every place sets its own level.
      </p>
    </div>
  );
}
