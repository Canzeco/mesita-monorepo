// A SETTING AND ITS VALUE, one per line, hairline-divided inside one card —
// the shape Account and the Setup index both use (MESITA-1840, 2002). It
// lived inside `OrdersView` until MESITA-2017 gave five more Setup halves
// the same rows; a row that is drawn on six screens is a primitive.
//
// Not `FactRow`: that lays facts out in a wrapping row, which is right for
// four read-only numbers on a wide card and wrong for a list somebody scans
// down looking for the one they came to change.
import { cn } from "@/lib/utils";

export const RULES_CARD =
  "border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border";

export function Rule({
  label,
  value,
  note,
  disabled = false,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  /** Greyed, never hidden: a row that vanishes teaches an operator the
   *  setting does not exist. The value slot decides its own affordance. */
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-12 items-center gap-4 px-4 py-2.5",
        disabled && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{label}</p>
        {note && (
          <p className="text-muted-foreground mt-0.5 text-[11.5px] leading-snug">
            {note}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-[13px] font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}
