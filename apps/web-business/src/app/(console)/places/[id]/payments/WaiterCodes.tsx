"use client";

// The place's ONE 6-digit code (Pato, MESITA-4904: "just one 6-digits code per
// place thats it"), made by Mesita, always shown to the owner (MESITA-4886: "it's
// not a nuclear code. show it"), and whether the waiter types their name before it.
// THE CODE IS OPTIONAL AT DISCOUNT (Pato, MESITA-4890: "enable the mode of no
// password, only for discounts … display a red warning"); saving Cashback turns
// it on again, on the server.
// Instant, not under Save changes: these are actions. The server refuses editors.

import { useEffect, useRef, useState } from "react";
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
  initialNoCode,
  mechanism,
  savedMechanism,
  canEdit,
  onError,
}: {
  placeId: string;
  initialCode: string | null;
  initialAskName: boolean;
  initialNoCode: boolean;
  /** What Visit Checkout shows: Cashback needs a code (MESITA-4890). */
  mechanism: "discount" | "cashback";
  /** What the server holds: it refuses codes off while this is Cashback. */
  savedMechanism: "discount" | "cashback";
  canEdit: boolean;
  onError: (error: string | null) => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [askName, setAskName] = useState(initialAskName);
  const [noCode, setNoCode] = useState(initialNoCode);
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

  // Saving Cashback turned codes on again on the server (MESITA-4900).
  const [lastSaved, setLastSaved] = useState(savedMechanism);
  if (lastSaved !== savedMechanism) {
    setLastSaved(savedMechanism);
    if (savedMechanism === "cashback") setNoCode(false);
  }

  // Read after the answer: Cashback may have been saved while codes_off was
  // in flight, and that turned the code on again (MESITA-4918).
  const savedNow = useRef(savedMechanism);
  useEffect(() => {
    savedNow.current = savedMechanism;
  }, [savedMechanism]);

  const off = noCode && mechanism === "discount";
  async function toggle() {
    if (!off && !window.confirm("Turn the waiter code off? Anyone who scans a guest's QR could send and confirm bills in your name.")) return;
    if (await run(off ? "codes_on" : "codes_off")) setNoCode(!off && savedNow.current === "discount");
  }

  async function newCode() {
    if (code && !window.confirm("Make a new code? The old one stops working now.")) return;
    const r = await run("new_code");
    if (r?.code) setCode(r.code);
  }

  async function toggleName() {
    if (await run(askName ? "name_off" : "name_on")) setAskName(!askName);
  }

  if (!canEdit && !off) {
    return <p className="text-muted-foreground border-border border-t px-5 py-3 text-sm sm:px-6">Only the owner sees the code.</p>;
  }
  return (
    <div className="text-sm" data-waiter-codes>
      {canEdit ? (
        <div className={ROW} data-place-state="waiter_codes_required">
          <span>
            <span className="block text-base font-medium">Ask for the waiter code</span>
            <span className="text-muted-foreground block">{mechanism === "cashback" ? "Cashback always needs a code." : savedMechanism === "cashback" ? "Save Discount first to turn it off." : "You can turn it off at Discount only."}</span>
          </span>
          <Switch
            on={!off}
            pending={busy || mechanism === "cashback" || savedMechanism === "cashback"}
            label={`Ask for the waiter code: ${off ? "off" : "on"}`}
            onClick={() => void toggle()}
          />
        </div>
      ) : null}
      {off ? (
        <p className="border-border border-t bg-red-50 px-5 py-3 font-semibold text-red-700 sm:px-6" role="alert" data-no-code-warning>
          Warning: without a code, anyone who scans a guest&apos;s QR can send and confirm bills in your name, even the guest. Only bills
          opened from your place&apos;s page on Mesita work without a code.
        </p>
      ) : (
        <>
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
              <span className="text-muted-foreground block">They type it before the code. It shows on the visit.</span>
            </span>
            <Switch on={askName} pending={busy || !code} label={`Ask for the waiter's name: ${askName ? "on" : "off"}`} onClick={() => void toggleName()} />
          </div>
        </>
      )}
    </div>
  );
}
