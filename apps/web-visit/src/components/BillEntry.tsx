"use client";

import { useEffect, useRef, useState } from "react";
import { amountText, moneyLabel, readAmount } from "@mesita/place-profile/lib/money";
import { amountParts, type Key, percentTip, pressAmount, pressCode, tipFor, WAITER_CODE_LENGTH } from "@/lib/waiter-pad";

// THE WAITER'S FOUR STEPS since MESITA-4916 (Pato, 2026-11-24: "before anything,
// input the actual 6 digits code: 1. Code 2. Bill 3. Confirm 4. Receipt"; the
// code came after the tip under MESITA-4889), one thing per screen, on keys drawn
// in the page (MESITA-4871):
//
//   Code     the place's 6 digits
//   Name     the waiter's, only where the owner asks (Pato, MESITA-4925: "it must be
//            after the code not before"); then whose QR it is
//   Bill     the bill, before tip; then the tip, 10 · 15 · 20% · Other, nothing is no tip; Send bill
//   Payment  the handshake: this tap and the guest's Pay, in any order
//   Receipt  what was paid
//
// The tip is never picked for the guest.

const KEYS: Key[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
const REARM_MS = 700;
const TIP_PCTS = [10, 15, 20] as const;

export const WAITER_STEPS = ["Code", "Name", "Bill", "Payment", "Receipt"] as const;
export type WaiterStep = (typeof WAITER_STEPS)[number];

/** Where the waiter is; a picture, not buttons. `named`: this place asks for a name. */
export function WaiterSteps({ at, named, onBack, busy }: { at: WaiterStep; named: boolean; onBack?: () => void; busy?: boolean }) {
  const steps = WAITER_STEPS.filter((s) => named || s !== "Name");
  return (
    <div className="wp-head">
      {onBack ? (
        <button type="button" className="wp-back" aria-label="Back" disabled={busy} onClick={onBack}>
          ‹
        </button>
      ) : null}
      <ol className="wp-steps">
        {steps.map((s, i) => (
          <li key={s} aria-current={s === at ? "step" : undefined} className={i <= steps.indexOf(at) ? "wp-on" : undefined}>
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

/** The place's code: after the scan, or again from another phone. `named`: the
 *  owner asks for the waiter's name; `askName`: the code was right, so it is asked
 *  now (MESITA-4925). Nothing is kept. */
export function CodeEntry({ busy, error, label, named, askName, onCode, onBack }: { busy: boolean; error: string | null; label: string; named: boolean; askName: boolean; onCode: (code: string, name: string | null) => Promise<boolean>; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const ready = code.length === WAITER_CODE_LENGTH && !busy;
  const go = () => {
    if (ready) void onCode(code, null).then((ok) => !ok && setCode(""));
  };
  if (askName) {
    const sendable = name.trim() !== "" && !busy;
    const next = () => {
      if (sendable) void onCode(code, name.trim()).then((ok) => !ok && setCode(""));
    };
    return (
      <main className="wp" data-bill="name">
        <WaiterSteps at="Name" named busy={busy} onBack={onBack} />
        <div className="wp-body">
          <h1 className="wp-title">Your name</h1>
          <input
            className="wp-input"
            value={name}
            maxLength={40}
            autoFocus
            autoComplete="off"
            aria-label="Your name"
            placeholder="Your name"
            enterKeyHint="next"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) next();
            }}
          />
          <Alert text={error} />
        </div>
        <button type="button" className="wp-go" disabled={!sendable} onClick={next}>
          {busy ? "Checking…" : label}
        </button>
      </main>
    );
  }
  return (
    <main className="wp" data-bill="code">
      <WaiterSteps at="Code" named={named} busy={busy} />
      <div className="wp-body">
        <h1 className="wp-title">Waiter code</h1>
        <Code code={code} />
        <Alert text={error} />
      </div>
      <Keypad onKey={(k) => setCode((c) => pressCode(c, k))} onEnter={go} />
      <button type="button" className="wp-go" disabled={!ready} onClick={go}>
        {busy ? "Checking…" : named ? "Next" : label}
      </button>
    </main>
  );
}

/** Whose QR it is, before the bill is typed. */
export function GuestCheck({ named, name, photo, age, sex, busy, error, onYes, onNo }: { named: boolean; name: string | null; photo: string | null; age: number | null; sex: "female" | "male" | null; busy: boolean; error: string | null; onYes: () => void; onNo: () => void }) {
  return (
    <main className="wp" data-bill="guest">
      <WaiterSteps at={named ? "Name" : "Code"} named={named} />
      <div className="wp-body">
        <h1 className="wp-title">Is this your guest?</h1>
        <span className="wp-face" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo ? <img src={photo} alt="" /> : (name ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <p className="wp-name">{name ?? "A Mesita guest"}</p>
        {/* MESITA-4890, Pato: "display age and sex". */}
        {age !== null || sex ? <p className="wp-line">{[sex === "female" ? "Female" : sex === "male" ? "Male" : null, age !== null ? `${age} years` : null].filter(Boolean).join(" · ")}</p> : null}
        {photo ? null : <p className="wp-line">No photo, ask their name</p>}
        <Alert text={error} />
      </div>
      <div className="wp-actions wp-half">
      <button type="button" className="wp-no" disabled={busy} onClick={onNo}>
        {busy ? "Closing…" : "Not my guest"}
      </button>
      <button type="button" className="wp-go wp-yes" disabled={busy} onClick={onYes}>
        Yes
      </button>
      </div>
    </main>
  );
}

export type BillEntryProps = {
  /** This place asks for the waiter's name. */
  named: boolean;
  /** Cents to start from, on an edit. */
  start?: { bill: number; tip: number };
  busy: boolean;
  error: string | null;
  /** Above the amount: the test band, or why it is typed again. */
  top?: React.ReactNode;
  /** Every key, for the guest's screen (MESITA-4883). */
  onTyping?: (billCents: number, tipCents: number, step: "bill" | "tip") => void;
  onSend: (billCents: number, tipCents: number) => void;
  onLeave?: () => void;
};

export function BillEntry({ named, start, busy, error, top, onTyping, onSend, onLeave }: BillEntryProps) {
  const [step, setStep] = useState(0);
  const [bill, setBill] = useState(start?.bill ? amountText(start.bill) : "");
  // A tip is a picked percent, which follows the bill, or typed.
  const [picked, setPicked] = useState<number | null>(() =>
    start?.tip ? (TIP_PCTS.find((p) => percentTip(start.bill, p) === start.tip) ?? null) : null,
  );
  const [typed, setTyped] = useState(start?.tip && picked === null ? amountText(start.tip) : "");
  const [other, setOther] = useState(false);
  const tipAt = useRef(0);
  const billCents = readAmount(bill);
  const tipCents = tipFor(billCents, picked, typed);
  const tip = picked === null ? typed : tipCents > 0 ? amountText(tipCents) : "";
  const m = (c: number) => moneyLabel(c, "USD");
  const pct = (p: number) => percentTip(billCents, p);
  const typing = other || (tipCents > 0 && picked === null);
  const ready = !busy && billCents !== null;

  useEffect(() => {
    onTyping?.(billCents ?? 0, tipCents, step === 0 ? "bill" : "tip");
  }, [onTyping, billCents, tipCents, step]);

  const go = () => {
    if (!ready || billCents === null) return;
    if (step === 0) {
      tipAt.current = Date.now();
      return setStep(1);
    }
    // Next and Send bill are one spot: a second tap is not a bill with no tip.
    if (Date.now() - tipAt.current < REARM_MS) return;
    onSend(billCents, tipCents);
  };

  return (
    <main className="wp" data-bill="type" data-step={step === 0 ? "bill" : "tip"}>
      <WaiterSteps at="Bill" named={named} busy={busy} onBack={step > 0 ? () => setStep(0) : onLeave} />
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
            <p className="wp-line">Bill {m(billCents ?? 0)} · Total {m((billCents ?? 0) + tipCents)}</p>
            <div className="wp-tips" role="group" aria-label="Tip">
              {TIP_PCTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={picked === p}
                  onClick={() => {
                    setOther(false);
                    setTyped("");
                    setPicked(picked === p ? null : p);
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
                  if (!typing) setTyped("");
                  setPicked(null);
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
          setPicked(null);
          setTyped((t) => pressAmount(fresh ? "" : t, k));
        }}
        onEnter={go}
      />
      <button type="button" className="wp-go" disabled={!ready} onClick={go}>
        {busy ? "Sending…" : step === 0 ? "Next" : tipCents === 0 ? "Send bill, no tip" : "Send bill"}
      </button>
    </main>
  );
}
