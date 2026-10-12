// The place heading's state chip. Only the warning state gets a chip: a place
// is Disabled when the operator switched it off and no guest can reach it.
// An enabled place wears nothing.

/** The bordered-chip grammar every state chip on a heading wears: 11px, a
 *  dot, the card's own background. One string so a new chip cannot drift. */
const CHIP_CLASS =
  "border-border bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 type-label font-semibold";

export function DisabledBadge() {
  return (
    <span className={CHIP_CLASS}>
      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
      Disabled
    </span>
  );
}
