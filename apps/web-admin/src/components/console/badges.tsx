// The place heading's state chip. A PLACE is Listed when Atlas found it and a
// guest can reach it; that is the only state the First Stage schema carries,
// so the chip is a single word.

/** The bordered-chip grammar every state chip on a heading wears: 11px, a
 *  dot, the card's own background. One string so a new chip cannot drift. */
const CHIP_CLASS =
  "border-border bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 type-label font-semibold";

export function ListedBadge() {
  return (
    <span className={CHIP_CLASS}>
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
      Listed
    </span>
  );
}
