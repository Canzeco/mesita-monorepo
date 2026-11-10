"use client";

// The waiter code (MESITA-3226, Pato: "there they only set the fucking number";
// on Payments' Cash Payments since MESITA-3600, Pato: "move waiter code
// configuration to Payments, not there"). Six digits waiters type at
// visit.mesita.ai to confirm a cash bill. Only a hash is kept, so it is never
// shown again and a forgotten one is replaced. The server refuses editors.

import { useState } from "react";
import { HashIcon } from "@phosphor-icons/react/dist/ssr";
import { INPUT_BASE } from "@/components/ui/manage";
import { setPlaceCode } from "@/lib/business-api";
import { cn } from "@/lib/utils";

const QUIET =
  "border-border hover:bg-muted h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-40";

/** The Waiter code row: one <li> of the Cash Payments list. */
export function WaiterCodeRow({
  placeId,
  isSet,
  canEdit,
  onSet,
  onError,
}: {
  placeId: string;
  isSet: boolean;
  canEdit: boolean;
  onSet: () => void;
  onError: (error: string | null) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setSaved(false);
    onError(null);
    const r = await setPlaceCode(placeId, code);
    setBusy(false);
    if (!r.ok) return onError(r.error);
    setSaved(true);
    setCode("");
    onSet();
  }

  return (
    <li id="waiter-code" className="flex min-h-16 scroll-mt-24 flex-wrap items-center gap-4 px-5 py-3 text-sm sm:px-6" data-place-state="waiter_code">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", isSet ? "bg-lime-100 text-lime-700" : "bg-muted text-muted-foreground")}>
        <HashIcon size={22} weight={isSet ? "fill" : "regular"} aria-hidden />
      </span>
      {/* The minimum is what lets the box wrap under the text on a phone. */}
      <div className="min-w-48 flex-1">
        <p className="font-medium">Waiter code</p>
        <p className="text-muted-foreground">
          {saved
            ? "Saved. It won't be shown again."
            : isSet
              ? "Six digits your waiters type at visit.mesita.ai. Type six new digits to replace it."
              : "Six digits your waiters type at visit.mesita.ai."}
        </p>
      </div>
      <p className={cn("font-semibold whitespace-nowrap", !isSet && "text-muted-foreground")}>{isSet ? "Set" : "Not set"}</p>
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
            aria-label="Waiter code"
            className={cn(INPUT_BASE, "h-10 w-28 px-3 tabular-nums")}
          />
          <button type="button" className={QUIET} disabled={code.length !== 6 || busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      ) : null}
    </li>
  );
}
