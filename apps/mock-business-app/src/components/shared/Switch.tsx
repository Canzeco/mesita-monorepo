// ONE SWITCH, NATIVE UNDERNEATH (MESITA-2017).
//
// It is a checkbox with `role="switch"`, so the keyboard, the screen reader
// and the focus ring all come from the browser and none of them from here.
// The label is the ROW's job (`Rule`), which is why this takes `aria-label`
// rather than drawing a second one: a switch with its own caption beside a
// row that already names the setting says the setting twice.
//
// It NEVER hides when disabled. A disabled switch beside a reason is how the
// cashback row says "needs Prepaid Credits"; a missing switch says nothing.
import { FOCUS_RING_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export function Switch({
  on,
  onChange,
  label,
  disabled = false,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  /** The accessible name — the row's label, repeated for the reader only. */
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition disabled:cursor-not-allowed",
        FOCUS_RING_CLASS,
        on
          ? "border-foreground bg-foreground"
          : "border-border bg-muted",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "bg-paper absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-full transition-transform",
          on ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
