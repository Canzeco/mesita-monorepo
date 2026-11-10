import { cn } from "../lib/format";
import { premierLabel } from "../premier";

// THE SEAL ALONE (Pato, MESITA-3420: "just red or/and green bubble. don't
// mention the premier tier. it doesn't matter really"): the rosette is the
// whole mark; "Premier 1" / "1X" left. Only the paid-placement "Ad"
// (MESITA-3016) still rides beside it on Home and Search.
// THE PREMIER MARK (Pato, MESITA-2925: "Just Premier for the moment, and
// mention the level: Premier 2X · Premier 5X"; 10X retired, MESITA-3041): the red
// rosette right after a place's name, then its level in the same red. It
// draws only for a Premier place (`boost_tier` 1..2) and is the place's
// one mark: the grey "Boosted" text and the Selected check are gone.
// Display only; it is never a button.
//
// The rosette IS the classic Twitter verified badge in red (Pato,
// MESITA-2865), 20px after the name (MESITA-2628). `compact` keeps the
// rosette and the level alone ("2X") where a narrow card has no room for
// the word; the place screen always says Premier.
//
// `ad` (Pato, MESITA-3016: "marca … para que se entienda que es como paid
// ad") appends "· Ad" where Premier lifted the place's rank: every Premier
// Home tile (one list, MESITA-3041: the factor lifts each one) and every
// Search rail card (the Map ranks by the paid factor). A Mesita grant lifts
// the rank too, so it is marked the same.

/** The scalloped seal both marks wear (Premier red, Mesita Payments green). */
export const SEAL_PATH =
  "M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34Z";

/** The red rosette alone, where a screen shows the mark without a place's level
 *  (Business's plan boxes, MESITA-3183). */
export function PremierRosette({ className }: { className?: string } = {}) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Mesita Premier"
      className={cn("inline-block h-5 w-5 shrink-0", className)}
    >
      <title>Mesita Premier</title>
      <path
        d={SEAL_PATH}
        fill="#F4212E"
      />
      <path
        d="M10.54 16.2 6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77Z"
        fill="#fff"
      />
    </svg>
  );
}

export function PremierBadge({
  tier,
  ad = false,
  className,
}: {
  tier: number | null | undefined;
  /** Kept for callers; the seal has no words to shorten (MESITA-3420). */
  compact?: boolean;
  ad?: boolean;
  className?: string;
}) {
  if (!premierLabel(tier)) return null;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1", className)}
      data-premier={tier}
    >
      <PremierRosette />
      {ad ? (
        <span className="text-muted-foreground text-xs leading-none font-semibold whitespace-nowrap">Ad</span>
      ) : null}
    </span>
  );
}
