"use client";

import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { amountShown, keyLive, type PadKey } from "@/lib/pay-keypad";
import { cn } from "@/lib/utils";

// THE PAY KEYPAD (MESITA-3739): 1–9, ".", 0, ⌫ drawn in the page, so the
// phone's keyboard never opens, covers Next or pushes the step into a
// scroll. Its rows share the height left in the step (each 44–64px), so a
// taller browser bar shrinks the keys a little instead of bringing a scroll
// back; past four rows of 64px the grid stops growing and sits at the
// bottom, above Next. Its flex basis is that full height, so a spacer put
// above it (and above the amount) takes only what the keys do not need. THE BUTTON IS THE GRID CELL (MESITA-3758): no gap
// between cells and no maximum height on the tap target, so a tap anywhere
// in a key's cell types that key (until then each key stopped at 64px inside
// a taller row and a tap under a digit landed on nothing). The visible key
// is a shape inset inside the cell, which shows the press. A key that cannot
// add anything now is dimmed, so it never looks broken. The rules are
// pressKey's (lib/pay-keypad.ts).

const KEYS: PadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
const LABEL: Partial<Record<PadKey, string>> = { ".": "Decimal point", back: "Delete" };

export function AmountKeypad({ text, onKey }: { text: string; onKey: (k: PadKey) => void }) {
  return (
    <div className="mt-auto grid max-h-64 min-h-0 flex-[1_1_16rem] grid-cols-3 grid-rows-[repeat(4,minmax(2.75rem,1fr))]" data-pay-keypad>
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
            className={cn("group flex touch-manipulation items-stretch justify-stretch p-0.5 select-none", !live && "opacity-40")}
          >
            <span className="group-active:bg-muted flex flex-1 items-center justify-center rounded-2xl text-2xl font-semibold tabular-nums transition">
              {k === "back" ? <Delete className="h-6 w-6" aria-hidden /> : k}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Roughly how wide a character draws, in ems of this face at semibold:
 *  digits are tabular, points and commas are narrow, letters are wide. */
function widthEm(text: string): number {
  let em = 0;
  for (const ch of text) em += /[0-9$]/.test(ch) ? 0.64 : /[.,\s]/.test(ch) ? 0.32 : 0.86;
  return em;
}

/** The typed amount (MESITA-3759, MESITA-3766): one size, 40px semibold,
 *  at the top of the step under the strip, in the app's money format
 *  (amountShown: the formatter's prefix and suffix, the whole part grouped,
 *  decimals as typed, and the cents not typed yet as a muted ghost, so it
 *  always reads "$20.00MX"). Nothing typed is a muted "$0.00MX"; what the
 *  guest typed is ink, so a typed 0 is a 0. A long amount in a narrow row shrinks to
 *  fit (the row is a size container and the font is capped by its width):
 *  a digit is never cut off. A screen-reader copy speaks once the guest
 *  stops typing (not once per digit). */
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
  const shown = amountShown(text, currency);
  const em = Math.max(widthEm(shown.prefix + shown.body + shown.ghost + shown.suffix), 1);
  return (
    <div className={cn("@container flex h-16 w-full min-w-0 items-center", className)} data-pay-amount>
      <div
        aria-hidden
        className="w-full text-center leading-none font-semibold whitespace-nowrap tabular-nums"
        style={{ fontSize: `min(3rem, ${(100 / em).toFixed(2)}cqw)` }}
      >
        <span className={cn(text === "" && "text-muted-foreground")}>{shown.prefix}</span>
        {shown.body}
        <span className="text-muted-foreground">{shown.ghost}</span>
        <span className={cn(text === "" && "text-muted-foreground")}>{shown.suffix}</span>
      </div>
      <span role="status" className="sr-only">
        {`${label}, ${spoken === "" ? "0" : spoken} ${currency.toUpperCase()}`}
      </span>
    </div>
  );
}

/** The typed amount on the right of its panel's heading (MESITA-4082,
 *  Pato: "make at the right of bill mention how much was the bill"): one
 *  step over the 16px heading, semibold ink, tabular, in the app's money
 *  format with the untyped cents a muted ghost (amountShown), "$0.00MX"
 *  muted until a digit. It replaced the 40px display on the Bill step, so
 *  the keypad sits right under the heading row. The screen reader hears it
 *  once the guest stops typing, as AmountDisplay does. */
export function AmountInline({ text, currency, label }: { text: string; currency: string; label: string }) {
  const [spoken, setSpoken] = useState(text);
  useEffect(() => {
    const t = window.setTimeout(() => setSpoken(text), 500);
    return () => window.clearTimeout(t);
  }, [text]);
  const shown = amountShown(text, currency);
  return (
    <span className="min-w-0 text-lg leading-6 font-semibold whitespace-nowrap tabular-nums" data-pay-amount>
      <span aria-hidden>
        <span className={cn(text === "" && "text-muted-foreground")}>{shown.prefix}</span>
        {shown.body}
        <span className="text-muted-foreground">{shown.ghost}</span>
        <span className={cn(text === "" && "text-muted-foreground")}>{shown.suffix}</span>
      </span>
      <span role="status" className="sr-only">
        {`${label}, ${spoken === "" ? "0" : spoken} ${currency.toUpperCase()}`}
      </span>
    </span>
  );
}
