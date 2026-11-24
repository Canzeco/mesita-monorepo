"use client";

import { useEffect, useRef, useState } from "react";
import { amountText, moneyLabel, readAmount } from "@mesita/place-profile/lib/money";
import { amountParts, type Key, pressAmount, pressCode, tipOf, WAITER_CODE_LENGTH } from "@/lib/waiter-pad";

// THE WAITER TYPES (MESITA-4871, Pato: "ask the bill and tip but build a
// keyboard in the app"): one thing per screen, big, on keys drawn in the page.
//
//   Bill  ─►  Tip (10 · 15 · 20%, or typed; nothing is no tip)  ─►  Code  ─► Send
//
// The tip is never picked for the guest. An edit has no Code step: the bill's
// own key is kept for this tab.

const KEYS: Key[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
const TIP_PCTS = [10, 15, 20] as const;

function Keypad({ onKey, dot, onEnter }: { onKey: (k: Key) => void; dot?: boolean; onEnter: () => void }) {
  // A hardware keyboard types too. A focused button keeps its own Enter.
  const latest = useRef({ onKey, onEnter });
  useEffect(() => {
    latest.current = { onKey, onEnter };
  });
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) latest.current.onKey(e.key as Key);
      else if (e.key === "." && dot) latest.current.onKey(".");
      else if (e.key === "Backspace") latest.current.onKey("back");
      else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) latest.current.onEnter();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [dot]);
  return (
    <div className="wp-pad">
      {KEYS.map((k) =>
        k === "." && !dot ? (
          <span key={k} />
        ) : (
          <button key={k} type="button" className="wp-key" aria-label={k === "back" ? "Delete" : k === "." ? "Decimal point" : k} onClick={() => onKey(k)}>
            {k === "back" ? "⌫" : k}
          </button>
        ),
      )}
    </div>
  );
}

function Amount({ text, label }: { text: string; label: string }) {
  const { typed, ghost } = amountParts(text);
  return (
    <div className="wp-amount" role="status" aria-label={`${label} ${text || "0"}`}>
      <span aria-hidden>
        <span className={text === "" ? "wp-ghost" : undefined}>$</span>
        {typed}
        <span className="wp-ghost">{ghost}</span>
      </span>
    </div>
  );
}

function Code({ code }: { code: string }) {
  return (
    <div className="wp-code" role="status" aria-label={`${code.length} of ${WAITER_CODE_LENGTH} digits typed`}>
      {Array.from({ length: WAITER_CODE_LENGTH }, (_, i) => (
        <span key={i} className={`wp-digit${i === code.length ? " wp-next" : ""}`} aria-hidden>
          {code[i] ?? ""}
        </span>
      ))}
    </div>
  );
}

const Alert = ({ text }: { text: string | null }) =>
  text ? (
    <p className="proof-status warn" role="alert">
      {text}
    </p>
  ) : null;

/** The code alone: another phone, or a closed tab. */
export function CodeEntry({ busy, error, onCode }: { busy: boolean; error: string | null; onCode: (code: string) => Promise<boolean> }) {
  const [code, setCode] = useState("");
  const ready = code.length === WAITER_CODE_LENGTH && !busy;
  const go = () => {
    if (ready) void onCode(code).then((ok) => !ok && setCode(""));
  };
  return (
    <main className="wp" data-bill="code">
      <div className="wp-body">
        <h1 className="wp-title">Your waiter code</h1>
        <Code code={code} />
        <Alert text={error} />
      </div>
      <Keypad onKey={(k) => setCode((c) => pressCode(c, k))} onEnter={go} />
      <button type="button" className="wp-go" disabled={!ready} onClick={go}>
        {busy ? "Checking…" : "Open bill"}
      </button>
    </main>
  );
}

export type BillEntryProps = {
  /** Cents to start from, on an edit. */
  start?: { bill: number; tip: number };
  /** Ask for the waiter's code last. */
  withCode: boolean;
  busy: boolean;
  error: string | null;
  /** Above the amount: the test band, or why it is typed again. */
  top?: React.ReactNode;
  /** Resolves false when it did not go through: the code is typed again. */
  onSend: (billCents: number, tipCents: number, code: string) => Promise<boolean>;
  onLeave?: () => void;
};

export function BillEntry({ start, withCode, busy, error, top, onSend, onLeave }: BillEntryProps) {
  const [step, setStep] = useState(0);
  const [bill, setBill] = useState(start?.bill ? amountText(start.bill) : "");
  const [tip, setTip] = useState(start?.tip ? amountText(start.tip) : "");
  const [code, setCode] = useState("");
  const billCents = readAmount(bill);
  const tipCents = tipOf(tip);
  const m = (c: number) => moneyLabel(c, "USD");
  const total = (billCents ?? 0) + tipCents;
  const pct = (p: number) => Math.round(((billCents ?? 0) * p) / 100);
  const steps = withCode ? ["Bill", "Tip", "Code"] : ["Bill", "Tip"];
  const last = step === steps.length - 1;
  const ready = !busy && billCents !== null && (step < 2 || code.length === WAITER_CODE_LENGTH);

  const go = () => {
    if (!ready || billCents === null) return;
    if (!last) return setStep(step + 1);
    void onSend(billCents, tipCents, code).then((ok) => !ok && setCode(""));
  };
  const back = step > 0 ? () => setStep(step - 1) : onLeave;
  const label = busy ? "Sending…" : last ? `Send ${m(total)}` : step === 1 ? (tipCents > 0 ? "Next" : "No tip") : "Next";

  return (
    <main className="wp" data-bill="type" data-step={steps[step]}>
      <div className="wp-head">
        {back ? (
          <button type="button" className="wp-back" aria-label="Back" disabled={busy} onClick={back}>
            ‹
          </button>
        ) : (
          <span />
        )}
        <ol className="wp-steps">
          {steps.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined} className={i <= step ? "wp-on" : undefined}>
              {s}
            </li>
          ))}
        </ol>
        <span />
      </div>
      {top}
      <div className="wp-body">
        <h1 className="wp-title">{step === 0 ? "How much is the bill?" : step === 1 ? "Tip? Ask the guest" : "Your waiter code"}</h1>
        {step === 0 ? (
          <>
            <Amount text={bill} label="Bill" />
            <p className="wp-line">Before tip</p>
          </>
        ) : step === 1 ? (
          <>
            <Amount text={tip} label="Tip" />
            <p className="wp-line">Bill {m(billCents ?? 0)}</p>
            <div className="wp-tips" role="group" aria-label="Tip">
              {TIP_PCTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={tipCents > 0 && tipCents === pct(p)}
                  onClick={() => setTip((t) => (tipOf(t) === pct(p) ? "" : amountText(pct(p))))}
                >
                  <b>{p}%</b>
                  {m(pct(p))}
                </button>
              ))}
            </div>
            {billCents !== null && tipCents * 2 > billCents ? (
              <p className="proof-status warn" role="status">
                Tip is more than half the bill. Check it.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <Code code={code} />
            <p className="wp-line">
              Bill {m(billCents ?? 0)} · {tipCents > 0 ? `Tip ${m(tipCents)}` : "No tip"}
            </p>
          </>
        )}
        <Alert text={error} />
      </div>
      {step === 2 ? (
        <Keypad onKey={(k) => setCode((c) => pressCode(c, k))} onEnter={go} />
      ) : (
        <Keypad dot onKey={(k) => (step === 0 ? setBill : setTip)((t) => pressAmount(t, k))} onEnter={go} />
      )}
      <button type="button" className="wp-go" disabled={!ready} onClick={go}>
        {label}
      </button>
    </main>
  );
}
