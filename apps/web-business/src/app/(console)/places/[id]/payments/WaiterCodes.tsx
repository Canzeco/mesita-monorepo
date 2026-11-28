"use client";

// The place's ONE 6-digit code (Pato, MESITA-4904: "just one 6-digits code per
// place thats it"), made by Mesita, always shown to the owner (MESITA-4886: "it's
// not a nuclear code. show it"), and whether the waiter types their name after it.
// Every bill needs the code: the no-code mode left with Discount (MESITA-5076).
// Instant, not under Save changes: these are actions. The server refuses editors.

import { useState } from "react";
import { setWaiter } from "@/lib/business-api";
import { Switch } from "@/components/ui/config";
import { PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { attempt } from "@/lib/attempt";

const ROW = "border-border flex items-center justify-between gap-4 border-t px-5 py-3.5 sm:px-6";

export function WaiterCodes({
  placeId,
  initialCode,
  initialAskName,
  canEdit,
  onError,
}: {
  placeId: string;
  initialCode: string | null;
  initialAskName: boolean;
  canEdit: boolean;
  onError: (error: string | null) => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [askName, setAskName] = useState(initialAskName);
  const [busy, setBusy] = useState(false);

  async function run(action: Parameters<typeof setWaiter>[1]) {
    if (busy) return null;
    setBusy(true);
    onError(null);
    const r = await attempt(setWaiter(placeId, action));
    setBusy(false);
    if (r.ok) return r.data;
    onError(r.error);
    return null;
  }

  async function newCode() {
    if (code && !window.confirm("Make a new code? The old one stops working now.")) return;
    const r = await run("new_code");
    if (r?.code) setCode(r.code);
  }

  async function toggleName() {
    if (await run(askName ? "name_off" : "name_on")) setAskName(!askName);
  }

  if (!canEdit) {
    return <p className="text-muted-foreground border-border border-t px-5 py-3 text-sm sm:px-6">Only the owner sees the code.</p>;
  }
  return (
    <div className="text-sm" data-waiter-codes>
      <div className={ROW}>
        <span className={cn(code ? "text-2xl font-semibold tracking-wider tabular-nums select-all" : "text-muted-foreground")}>
          {code ? `${code.slice(0, 3)} ${code.slice(3)}` : "No code yet. Without one, nobody can send bills."}
        </span>
        <button type="button" className={cn(PILL_BUTTON_CLASS, "h-10 shrink-0 px-4 text-sm whitespace-nowrap")} disabled={busy} onClick={() => void newCode()}>
          New code
        </button>
      </div>
      <div className={ROW}>
        <span>
          <span className="block text-base font-medium">Ask for the waiter&apos;s name</span>
          <span className="text-muted-foreground block">They type it after the code. It shows on the visit.</span>
        </span>
        <Switch on={askName} pending={busy || !code} label={`Ask for the waiter's name: ${askName ? "on" : "off"}`} onClick={() => void toggleName()} />
      </div>
    </div>
  );
}
