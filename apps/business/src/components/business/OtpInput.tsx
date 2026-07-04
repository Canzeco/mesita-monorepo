import { cn } from "@/lib/utils";

// 6-cell OTP input. Native <input> sits invisibly over the cells so
// autoComplete="one-time-code", paste, and the on-screen numeric
// keypad all keep working; the visible cells just reflect its value.
export function OtpInput({
  value,
  onChange,
  disabled,
  hasError,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  hasError: boolean;
  autoFocus?: boolean;
}) {
  const cells = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  // The "next empty" cell shows the focus ring while typing. Once all
  // six are filled, no cell is highlighted — the row reads as complete.
  const focusIndex = value.length < 6 ? value.length : -1;
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, "").slice(0, 6))
        }
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label="6-digit verification code"
        aria-invalid={hasError}
        className="absolute inset-0 z-10 w-full cursor-text bg-transparent text-transparent caret-transparent outline-none disabled:cursor-not-allowed"
      />
      <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
        {cells.map((char, i) => {
          const filled = char !== "";
          const focused = !disabled && i === focusIndex;
          return (
            <div
              key={i}
              className={cn(
                "bg-background flex h-14 items-center justify-center rounded-xl border font-mono text-2xl font-semibold tabular-nums transition",
                hasError
                  ? "border-destructive/50"
                  : focused
                    ? "border-primary ring-primary/15 ring-2"
                    : filled
                      ? "border-foreground/20"
                      : "border-border",
                disabled && "opacity-60",
              )}
            >
              {char}
            </div>
          );
        })}
      </div>
    </div>
  );
}
