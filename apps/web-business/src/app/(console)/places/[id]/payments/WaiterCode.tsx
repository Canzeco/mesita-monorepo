"use client";

// The place code (MESITA-3226, Pato: "there they only set the fucking number";
// on Settings since MESITA-3299). Six digits staff type at visit.mesita.ai.
// Only a hash is kept, so it is never shown again and a forgotten one is
// replaced. The server refuses editors.

import { useState } from "react";
import { Card } from "@/components/shell/Page";
import { INPUT_BASE } from "@/components/ui/manage";
import { setPlaceCode } from "@/lib/business-api";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const ROW = "flex min-h-14 flex-wrap items-center gap-3 px-5 py-3 text-sm sm:px-6";
const QUIET =
  "border-border hover:bg-muted h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-40";

export function PlaceCode({ placeId, initialSet, canEdit }: { placeId: string; initialSet: boolean; canEdit: boolean }) {
  const [isSet, setIsSet] = useState(initialSet);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(null);
    const r = await setPlaceCode(placeId, code);
    setBusy(false);
    if (r.ok) {
      setIsSet(true);
      setSaved(true);
      setCode("");
    } else {
      setError(r.error);
    }
  }

  return (
    <>
      <Card className="flex flex-col p-0 sm:p-0">
        <div className={ROW}>
          {/* The minimum is what lets the box wrap under the text on a phone. */}
          <div className="min-w-56 flex-1">
            <p className="font-medium">Place code</p>
            <p className="text-muted-foreground">
              {saved
                ? "Saved. It won't be shown again."
                : isSet
                  ? "Set. It won't be shown again; type six new digits to replace it."
                  : "Not set. Six digits your staff type at visit.mesita.ai."}
            </p>
          </div>
          {canEdit ? (
            <div className="flex shrink-0 items-center gap-3">
              <input
                value={code}
                onChange={(e) => {
                  setSaved(false);
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.length === 6 && !busy) void save();
                }}
                inputMode="numeric"
                autoComplete="off"
                placeholder="6 digits"
                aria-label="Place code"
                className={cn(INPUT_BASE, "h-10 w-28 px-3 tabular-nums")}
              />
              <button type="button" className={QUIET} disabled={code.length !== 6 || busy} onClick={() => void save()}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          ) : null}
        </div>
      </Card>
      {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}
    </>
  );
}
