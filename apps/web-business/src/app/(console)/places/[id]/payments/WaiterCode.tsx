"use client";

// The waiter code (MESITA-3226, Pato: "there they only set the fucking number";
// on Payments since MESITA-3600, Pato: "move waiter code configuration to
// Payments, not there"; its own section, last, since MESITA-3824). Six digits (MESITA-4827)
// waiters type on each bill (MESITA-4827); one made before that reads Not set. Only a hash is kept, so it is never
// shown again and a forgotten one is replaced. The server refuses editors.

import { useState } from "react";
import { HashIcon } from "@phosphor-icons/react/dist/ssr";
import { setPlaceCode } from "@/lib/business-api";
import { cn } from "@/lib/utils";

const QUIET =
  "border-border hover:bg-muted h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-40";

/** The Waiter code row: the one <li> of the Waiter Code section (MESITA-3824). */
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
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function make() {
    if (isSet && !window.confirm("Make a new code? The old one stops working.")) return;
    setBusy(true);
    onError(null);
    const r = await setPlaceCode(placeId);
    setBusy(false);
    if (!r.ok) return onError(r.error);
    setCode(r.data);
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
          {code
            ? "Write it down and give it to your waiters. It won't be shown again."
            : isSet
              ? "Waiters scan the guest's QR and type this code on each bill. Forgot it? Make a new one."
              : "Waiters scan the guest's QR and type this code on each bill. Without it they can't send bills."}
        </p>
      </div>
      <p className={cn("font-semibold whitespace-nowrap tabular-nums", code && "text-2xl tracking-widest", !isSet && "text-muted-foreground")}>
        {code ?? (isSet ? "Set" : "Not set")}
      </p>
      {canEdit ? (
        <button type="button" className={QUIET} disabled={busy} onClick={() => void make()}>
          {busy ? "Making…" : isSet ? "New code" : "Make code"}
        </button>
      ) : null}
    </li>
  );
}
