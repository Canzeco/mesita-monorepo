"use client";

import { CODE_LENGTH, codeDigits, padPress, type PadKey } from "@/lib/code-boxes";
import { SIGN } from "@mesita/place-profile/lib/pay-steps";

// The waiter code as six boxes (MESITA-3818), typed on a pad drawn in the
// page (MESITA-4103, Pato: "when the keyboard opens in the web version in
// mobile it looks like shit. so just put the numbers there floating below"):
// the boxes only show, so the phone keyboard never opens, and the pad under
// them is the guest app's amount pad in miniature, 1-9 then ⌫ 0. A digit goes
// into the first empty box, ⌫ clears the last filled one; a hardware
// keyboard still types (and pastes) while the group has focus. The value
// stays one string in the parent; lib/code-boxes decides every edit.

// Three by three, then 0 under the 8 and ⌫ beside it: (3x3)+1.
const KEYS: PadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "back"];

export function CodeBoxes({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const digits = codeDigits(value);
  const next = digits.indexOf("");

  return (
    <div
      className="code-boxes"
      role="group"
      aria-labelledby="waiter-code-label"
      tabIndex={0}
      onKeyDown={(e) => {
        if (/^\d$/.test(e.key)) onChange(padPress(value, e.key as PadKey));
        else if (e.key === "Backspace") onChange(padPress(value, "back"));
        else return;
        e.preventDefault();
      }}
      onPaste={(e) => {
        e.preventDefault();
        let code = value;
        for (const d of e.clipboardData.getData("text").replace(/\D/g, "")) code = padPress(code, d as PadKey);
        onChange(code);
      }}
    >
      <p id="waiter-code-label" className="code-boxes-label">
        {SIGN.waiterCode}
      </p>
      <div className="code-boxes-row" aria-live="polite" aria-label={`${digits.filter(Boolean).length} of ${CODE_LENGTH} digits typed`}>
        {digits.map((d, i) => (
          <span key={i} className={`code-box${i === next ? " code-box-next" : ""}`} aria-hidden>
            {d ? "•" : ""}
          </span>
        ))}
      </div>
      <div className="code-pad">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className={`code-pad-key${k === "0" ? " code-pad-zero" : ""}`}
            aria-label={k === "back" ? "Delete" : k}
            onClick={() => onChange(padPress(value, k))}
          >
            {k === "back" ? "⌫" : k}
          </button>
        ))}
      </div>
    </div>
  );
}
