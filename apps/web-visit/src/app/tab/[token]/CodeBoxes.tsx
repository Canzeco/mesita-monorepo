"use client";

import { useRef } from "react";
import { backspaceCode, CODE_LENGTH, codeDigits, fillCode } from "@/lib/code-boxes";
import { SIGN } from "@mesita/place-profile/lib/pay-steps";

// The waiter code as six boxes (MESITA-3818). The value stays one string in
// the parent; lib/code-boxes decides every edit, this file only moves focus.
export function CodeBoxes({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const digits = codeDigits(value);

  function apply(next: { code: string; focus: number }) {
    onChange(next.code);
    const box = boxes.current[next.focus];
    box?.focus();
    box?.select();
  }

  function move(i: number) {
    const box = boxes.current[Math.max(0, Math.min(CODE_LENGTH - 1, i))];
    box?.focus();
    box?.select();
  }

  return (
    <div className="code-boxes" role="group" aria-labelledby="waiter-code-label">
      <p id="waiter-code-label" className="code-boxes-label">
        {SIGN.waiterCode}
      </p>
      <div className="code-boxes-row">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              boxes.current[i] = el;
            }}
            className="code-box"
            aria-label={`${SIGN.waiterCode} digit ${i + 1} of ${CODE_LENGTH}`}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={d}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const typed = e.currentTarget.value;
              if (typed === "") apply(backspaceCode(value, i));
              else apply(fillCode(value, i, typed));
            }}
            onPaste={(e) => {
              e.preventDefault();
              apply(fillCode(value, i, e.clipboardData.getData("text")));
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !d) {
                e.preventDefault();
                apply(backspaceCode(value, i));
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                move(i - 1);
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                move(i + 1);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
