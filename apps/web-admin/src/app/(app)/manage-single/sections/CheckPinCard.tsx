"use client";

import { useMemo, useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { setCheckPin, type AdminPlace } from "../actions";
import { SaveBar, SectionCard } from "../ui";

// Check PIN — the optional staff gate on the public check page (MESITA-823).
//
// Pato: "you scan a qr, and you need some 6 digits PIN to mark ticket as
// done. optional. but maybe big companies want that so there you have it."
//
// This is NOT a waiter account (MESITA-833 stands — staff hold no identity).
// It is ONE shared 6-digit secret per place: the manager briefs the floor
// with it, and check-page WRITE actions (bill, story/review verdict, paid)
// require it. Blank = off, which is the default and keeps the two-tap close.
export function CheckPinCard({ place }: { place: AdminPlace }) {
  const saved = useMemo(
    () => (typeof place.check_pin === "string" ? place.check_pin : ""),
    [place.check_pin],
  );
  const [pin, setPin] = useState(saved);
  const [current, setCurrent] = useState(saved);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = pin !== current;
  const valid = pin === "" || /^[0-9]{6}$/.test(pin);

  const save = () => {
    if (!valid) {
      setError("The PIN must be exactly 6 digits — or empty to turn the gate off.");
      return;
    }
    setError(null);
    setOk(false);
    start(async () => {
      const r = await setCheckPin(place.id, pin === "" ? null : pin);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const next = r.data ?? "";
      setCurrent(next);
      setPin(next);
      setOk(true);
      window.setTimeout(() => setOk(false), 2500);
    });
  };

  return (
    <SectionCard
      icon={<KeyRound className="h-4 w-4" />}
      tint="amber"
      title="Check PIN"
      subtitle="Optional 6-digit code staff must enter on the check page before billing or closing a ticket."
      action={
        <span
          className={
            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
            (current
              ? "bg-amber-500/10 text-amber-700"
              : "bg-muted text-muted-foreground")
          }
        >
          {current ? "Gate on" : "Gate off"}
        </span>
      }
    >
      <p className="text-muted-foreground mt-5 text-xs leading-relaxed">
        The QR itself is the authentication — anyone holding it can work the
        ticket. Turn this on and the place&apos;s staff also need a shared code,
        so a guest (or a passer-by who photographed the QR) can&apos;t self-bill.
        Scanning and viewing never ask for it; only bill, story/review verdicts
        and &ldquo;paid received&rdquo; do. Leave blank to keep the two-tap close.
      </p>
      <div className="mt-4 flex flex-col gap-1.5">
        <label
          htmlFor="check-pin"
          className="text-foreground/90 flex min-h-4 items-center text-[13px] font-medium"
        >
          PIN
        </label>
        <input
          id="check-pin"
          inputMode="numeric"
          autoComplete="off"
          placeholder="empty = no PIN"
          value={pin}
          disabled={pending}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="border-border bg-card focus:border-foreground h-11 w-40 rounded-xl border px-3.5 font-mono text-lg tracking-[0.3em] tabular-nums outline-none disabled:opacity-50"
        />
        {pin !== "" && !valid ? (
          <span className="text-xs font-medium text-amber-700">
            Needs all 6 digits.
          </span>
        ) : null}
      </div>
      <SaveBar
        pending={pending}
        dirtyLabel="Check PIN · unsaved"
        dirty={dirty}
        ok={ok}
        error={error}
        onSave={save}
        onCancel={() => setPin(current)}
      />
    </SectionCard>
  );
}
