"use client";

import { useState, useTransition } from "react";
import { Banknote } from "lucide-react";
import { setCheckRequireBill, type AdminPlace } from "../actions";
import { SaveBar, SectionCard } from "../ui";

// Require bill amount (MESITA-898) — the per-place opt-out of the v3b
// optional bill (MESITA-850).
//
// By default the bill is internal control, never a gate: staff can close a
// ticket on the check page without entering it and apply the discount at
// their own POS. Some places want the discipline of the number on record —
// this switch makes check-web-mark-paid refuse an unbilled close until the
// bill is submitted. Same save pattern as the sibling Check PIN card.
export function RequireBillCard({ place }: { place: AdminPlace }) {
  const saved = place.check_require_bill === true;
  const [on, setOn] = useState(saved);
  const [current, setCurrent] = useState(saved);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = on !== current;

  const save = () => {
    setError(null);
    setOk(false);
    start(async () => {
      const r = await setCheckRequireBill(place.id, on);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCurrent(r.data);
      setOn(r.data);
      setOk(true);
      window.setTimeout(() => setOk(false), 2500);
    });
  };

  return (
    <SectionCard
      icon={<Banknote className="h-4 w-4" />}
      tint="emerald"
      title="Require bill amount"
      subtitle="Make entering the bill mandatory before staff can close a ticket on the check page."
      action={
        <span
          className={
            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
            (current
              ? "bg-emerald-500/10 text-emerald-700"
              : "bg-muted text-muted-foreground")
          }
        >
          {current ? "Required" : "Optional"}
        </span>
      }
    >
      <p className="text-muted-foreground mt-5 text-xs leading-relaxed">
        By default the bill amount is optional — staff can close a ticket
        without it and apply the discount at their own point of sale; entering
        it exists for the place&apos;s internal control. Turn this on and the
        check page won&apos;t close a ticket until the bill amount has been
        entered.
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-foreground/90 text-[13px] font-medium">
          Bill amount required to close
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`Require bill amount ${on ? "on" : "off"}`}
          disabled={pending}
          onClick={() => setOn((v) => !v)}
          className={
            "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 " +
            (on ? "bg-pink-gradient" : "bg-border")
          }
        >
          <span
            className={
              "absolute h-4 w-4 rounded-full bg-white shadow transition " +
              (on ? "translate-x-4" : "translate-x-0.5")
            }
          />
        </button>
      </div>
      <SaveBar
        pending={pending}
        dirtyLabel="Require bill amount · unsaved"
        dirty={dirty}
        ok={ok}
        error={error}
        onSave={save}
        onCancel={() => setOn(current)}
      />
    </SectionCard>
  );
}
