"use client";

import { useEffect, useRef, useState } from "react";
import { amountText, moneyLabel, readAmount } from "@mesita/place-profile/lib/money";
import { amountParts, type Key, pressAmount, pressCode, tipOf, WAITER_CODE_LENGTH } from "@/lib/waiter-pad";

// THE WAITER'S FOUR STEPS (MESITA-4878, Pato: "1. Scan 2. Bill & Tip 3. Charge
// (must confirm) 4. Receipt"), one thing per screen, on keys drawn in the page
// (MESITA-4871):
//
//   Scan        the waiter's 8-digit code, then whose QR it is: Yes or No
//   Bill & Tip  the bill; the tip (10 · 15 · 20% · Other, nothing is no tip); Send
//   Charge      waiting for the guest, then Collect $X and Received, asked twice
//   Receipt     what was paid
//
// The tip is never picked for the guest.

const KEYS: Key[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
const TIP_PCTS = [10, 15, 20] as const;

export const WAITER_STEPS = ["Scan", "Bill & Tip", "Charge", "Receipt"] as const;

/** Where the waiter is; a picture, not buttons. */
export function WaiterSteps({ at, onBack, busy }: { at: 1 | 2 | 3 | 4; onBack?: () => void; busy?: boolean }) {
  return (
    <div className="wp-head">
      {onBack ? (
        <button type="button" className="wp-back" aria-label="Back" disabled={busy} onClick={onBack}>
          ‹
        </button>
      ) : null}
      <ol className="wp-steps">
        {WAITER_STEPS.map((s, i) => (
          <li key={s} aria-current={i + 1 === at ? "step" : undefined} className={i < at ? "wp-on" : undefined}>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

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

/** The waiter's code: after the scan, or again from another phone. */
export function CodeEntry({ busy, error, label, onCode }: { busy: boolean; error: string | null; label: string; onCode: (code: string) => Promise<boolean> }) {
  const [code, setCode] = useState("");
  const ready = code.length === WAITER_CODE_LENGTH && !busy;
  const go = () => {
    if (ready) void onCode(code).then((ok) => !ok && setCode(""));
  };
  return (
    <main className="wp" data-bill="code">
      <WaiterSteps at={1} />
      <div className="wp-body">
        <h1 className="wp-title">Your waiter code</h1>
        <Code code={code} />
        <Alert text={error} />
      </div>
      <Keypad onKey={(k) => setCode((c) => pressCode(c, k))} onEnter={go} />
      <button type="button" className="wp-go" disabled={!ready} onClick={go}>
        {busy ? "Checking…" : label}
      </button>
    </main>
  );
}

/** Whose QR it is, before any bill: the waiter looks and says. */
export function GuestCheck({ name, photo, busy, error, onYes, onNo }: { name: string | null; photo: string | null; busy: boolean; error: string | null; onYes: () => void; onNo: () => void }) {
  return (
    <main className="wp" data-bill="guest">
      <WaiterSteps at={1} />
      <div className="wp-body">
        <h1 className="wp-title">Is this your guest?</h1>
        <span className="wp-face" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo ? <img src={photo} alt="" /> : (name ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <p className="wp-name">{name ?? "A Mesita guest"}</p>
        {photo ? null : <p className="wp-line">No photo. Ask their name.</p>}
        <Alert text={error} />
      </div>
      <button type="button" className="wp-go" disabled={busy} onClick={onYes}>
        Yes
      </button>
      <button type="button" className="wp-no" disabled={busy} onClick={onNo}>
        {busy ? "Closing…" : "No, scan again"}
      </button>
    </main>
  );
}

export type BillEntryProps = {
  /** Cents to start from, on an edit. */
  start?: { bill: number; tip: number };
  busy: boolean;
  error: string | null;
  /** Above the amount: the test band, or why it is typed again. */
  top?: React.ReactNode;
  onSend: (billCents: number, tipCents: number) => void;
  onLeave?: () => void;
};

export function BillEntry({ start, busy, error, top, onSend, onLeave }: BillEntryProps) {
  const [step, setStep] = useState(0);
  const [bill, setBill] = useState(start?.bill ? amountText(start.bill) : "");
  const [tip, setTip] = useState(start?.tip ? amountText(start.tip) : "");
  const [other, setOther] = useState(false);
  const billCents = readAmount(bill);
  const tipCents = tipOf(tip);
  const m = (c: number) => moneyLabel(c, "USD");
  const pct = (p: number) => Math.round(((billCents ?? 0) * p) / 100);
  const picked = other || tipCents === 0 ? null : (TIP_PCTS.find((p) => pct(p) === tipCents) ?? null);
  const typing = other || (tipCents > 0 && picked === null);
  const ready = !busy && billCents !== null;

  const go = () => {
    if (!ready || billCents === null) return;
    if (step === 0) return setStep(1);
    onSend(billCents, tipCents);
  };

  return (
    <main className="wp" data-bill="type" data-step={step === 0 ? "bill" : "tip"}>
      <WaiterSteps at={2} busy={busy} onBack={step > 0 ? () => setStep(0) : onLeave} />
      {top}
      <div className="wp-body">
        <h1 className="wp-title">{step === 0 ? "How much is the bill?" : "Tip? Ask the guest"}</h1>
        {step === 0 ? (
          <>
            <Amount text={bill} label="Bill" />
            <p className="wp-line">Before tip</p>
          </>
        ) : (
          <>
            <Amount text={tip} label="Tip" />
            <p className="wp-line">Bill {m(billCents ?? 0)}</p>
            <div className="wp-tips" role="group" aria-label="Tip">
              {TIP_PCTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={picked === p}
                  onClick={() => {
                    setOther(false);
                    setTip(picked === p ? "" : amountText(pct(p)));
                  }}
                >
                  <b>{p}%</b>
                  {m(pct(p))}
                </button>
              ))}
              {/* OTHER (Pato, MESITA-4878: "10 15 20 other"): typed on the keys. */}
              <button
                type="button"
                aria-pressed={typing}
                onClick={() => {
                  setOther(true);
                  if (!typing) setTip("");
                }}
              >
                <b>Other</b>
                Type it
              </button>
            </div>
            {billCents !== null && tipCents * 2 > billCents ? (
              <p className="proof-status warn" role="status">
                Tip is more than half the bill. Check it.
              </p>
            ) : null}
          </>
        )}
        <Alert text={error} />
      </div>
      <Keypad
        dot
        onKey={(k) => {
          if (step === 0) return setBill((t) => pressAmount(t, k));
          // A key over a picked percent starts a new amount.
          const fresh = picked !== null;
          setOther(true);
          setTip((t) => pressAmount(fresh ? "" : t, k));
        }}
        onEnter={go}
      />
      <button type="button" className="wp-go" disabled={!ready} onClick={go}>
        {busy ? "Sending…" : step === 0 ? "Next" : `Send ${m((billCents ?? 0) + tipCents)}${tipCents > 0 ? "" : " · No tip"}`}
      </button>
    </main>
  );
}
