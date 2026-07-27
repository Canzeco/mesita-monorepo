import { Crown, Magnet } from "lucide-react";

import { cn } from "@/lib/utils";

// Three-class comparison — Standard / Premium / Magnetic in ladder order
// (standard < premium ≤ magnetic; Magnetic is the top tier and reads gold,
// matching the QR + summary cards). Premium and Magnetic tie on perks by
// design — best-of at the bill makes ties harmless — so the Price row is
// what separates them: Premium is paid, Magnetic is earned with reach.

const COMPARE_ROWS: {
  label: string;
  standard: string;
  premium: string;
  magnetic: string;
}[] = [
  { label: "Price", standard: "Free", premium: "$100/mo", magnetic: "Free" },
  { label: "Discounts", standard: "Base", premium: "Boosted", magnetic: "Boosted" },
  {
    label: "Recommendations",
    standard: "Standard",
    premium: "Personalized",
    magnetic: "Personalized",
  },
  {
    label: "Reservations / month",
    standard: "2",
    premium: "Unlimited",
    magnetic: "Unlimited",
  },
];

const GRID_COLS = "grid-cols-[1.1fr_0.7fr_0.95fr_0.95fr]";

export function ClassComparison() {
  return (
    <div className="border-border bg-card overflow-hidden rounded-2xl border px-2 py-1.5">
      <div className={cn("grid items-end gap-1 px-2 pt-2", GRID_COLS)}>
        <span />
        <CompareHead label="Standard" />
        <CompareHead label="Premium" accent="premium" />
        <CompareHead label="Magnetic" accent="magnetic" />
      </div>
      <div className="mt-1">
        {COMPARE_ROWS.map((row, i) => (
          <div
            key={row.label}
            className={cn(
              "grid items-center gap-1 px-2 py-3.5",
              GRID_COLS,
              i > 0 && "border-border/50 border-t",
            )}
          >
            <span className="text-foreground/80 text-[12px] leading-tight font-medium">
              {row.label}
            </span>
            <span className="text-foreground/70 text-center text-[12px] leading-tight font-semibold">
              {row.standard}
            </span>
            <span className="bg-tier-premium/[0.07] text-premium rounded-lg px-0.5 py-1.5 text-center text-[12px] leading-tight font-semibold">
              {row.premium}
            </span>
            <span className="rounded-lg bg-amber-400/15 px-0.5 py-1.5 text-center text-[12px] leading-tight font-semibold text-amber-700">
              {row.magnetic}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareHead({
  label,
  accent,
}: {
  label: string;
  accent?: "premium" | "magnetic";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-t-lg px-1 py-1.5",
        accent === "premium" && "bg-tier-premium/[0.07]",
        accent === "magnetic" && "bg-amber-400/15",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {accent === "premium" && (
          <Crown className="text-premium h-3 w-3 fill-current" />
        )}
        {accent === "magnetic" && <Magnet className="h-3 w-3 text-amber-700" />}
        <span
          className={cn(
            "font-display text-[12.5px] font-bold tracking-tight",
            accent === "premium" && "text-premium",
            accent === "magnetic" && "text-amber-700",
          )}
        >
          {label}
        </span>
      </span>
    </div>
  );
}
