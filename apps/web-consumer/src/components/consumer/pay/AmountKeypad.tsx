"use client";

import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { keyLive, type PadKey } from "@/lib/pay-keypad";
import { cn } from "@/lib/utils";

// THE PAY KEYPAD (MESITA-3739): 1–9, ".", 0, ⌫ drawn in the page, so the
// phone's keyboard never opens, covers Next or pushes the step into a
// scroll. Its rows share the height left in the step (each 44–64px), so a
// taller browser bar shrinks the keys a little instead of bringing a scroll
// back. A key that cannot add anything now is dimmed, so it never looks
// broken. The rules are pressKey's (lib/pay-keypad.ts).

const KEYS: PadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
const LABEL: Partial<Record<PadKey, string>> = { ".": "Decimal point", back: "Delete" };

export function AmountKeypad({ text, onKey }: { text: string; onKey: (k: PadKey) => void }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-4 gap-1.5" data-pay-keypad>
      {KEYS.map((k) => {
        const live = keyLive(text, k);
        return (
          <button
            key={k}
            type="button"
            data-pad-key
            aria-label={LABEL[k] ?? k}
            aria-disabled={!live}
            onClick={() => live && onKey(k)}
            className={cn(
              "flex min-h-11 max-h-16 items-center justify-center rounded-2xl text-2xl font-semibold tabular-nums transition select-none active:bg-muted",
              !live && "opacity-40",
            )}
          >
            {k === "back" ? <Delete className="h-6 w-6" aria-hidden /> : k}
          </button>
        );
      })}
    </div>
  );
}

/** The typed amount, big and immediate, with a screen-reader copy that
 *  speaks once the guest stops typing (not once per digit). */
export function AmountDisplay({
  text,
  currency,
  label,
  className,
}: {
  text: string;
  currency: string;
  /** What the amount is, for the screen reader ("Bill", "Tip"). */
  label: string;
  className?: string;
}) {
  const [spoken, setSpoken] = useState(text);
  useEffect(() => {
    const t = window.setTimeout(() => setSpoken(text), 500);
    return () => window.clearTimeout(t);
  }, [text]);
  return (
    <div className={cn("flex items-baseline justify-center gap-1.5", className)}>
      <span aria-hidden className="text-muted-foreground text-3xl font-semibold">
        $
      </span>
      <span aria-hidden className={cn("min-w-0 truncate text-5xl font-semibold tabular-nums", text === "" && "text-muted-foreground/50")}>
        {text === "" ? "0" : text}
      </span>
      <span aria-hidden className="text-muted-foreground text-base font-semibold">
        {currency.toUpperCase()}
      </span>
      <span role="status" className="sr-only">
        {`${label}, ${spoken === "" ? "0" : spoken} pesos`}
      </span>
    </div>
  );
}
