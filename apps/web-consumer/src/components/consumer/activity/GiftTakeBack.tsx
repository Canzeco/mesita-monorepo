"use client";

// TAKE BACK, ONE CONFIRM (MESITA-4066's, its own file since MESITA-4324): the
// sender of an open gift takes it back, from the gift's page (a full-width
// black button) or from its waiting Gifts row (a small grey pill, Pato:
// "remove the waiting for a friend list … that must be in gifts"). One
// LocalDialog yes/no, then the wallet read again either way (a friend may
// have taken it meanwhile).

import { type ReactNode, useState } from "react";
import { Loader2 } from "lucide-react";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import { apiTakeBackCredit, GIFT_REFUSAL, money, type GiftTicket } from "@/lib/api/wallet";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { ERROR_BOX_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";

const FILLED =
  "bg-foreground text-background flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition hover:opacity-90 disabled:opacity-60";
const OUTLINE =
  "border-border bg-card hover:bg-muted/60 flex h-11 w-full items-center justify-center rounded-full border text-sm font-semibold transition disabled:opacity-60";
// A quiet grey pill with a 44px tap area (the after: box) on a 32px shape.
const PILL =
  "bg-muted text-foreground hover:bg-border relative flex h-8 shrink-0 items-center rounded-full px-3 text-sm font-semibold transition after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-['']";

/** The sender of an open gift takes it back: one confirm, then the read again. */
export function TakeBack({
  g,
  onDone,
  variant = "filled",
  trigger,
}: {
  g: GiftTicket;
  onDone: () => void;
  /** "pill": the small grey button on a waiting Gifts row (MESITA-4324). */
  variant?: "filled" | "pill";
  /** Draws the opener instead of the button: the gift ticket's footer
   *  button (MESITA-4637). */
  trigger?: (open: () => void) => ReactNode;
}) {
  const getSupabase = useLazyBrowserSupabase();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = money(g.amount_cents, g.currency);
  const place = g.place?.name ?? "this place";

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const r = await apiTakeBackCredit(getSupabase(), g.gift_id);
      toast.success(`${money(r.amount_cents, r.currency)} is back in your balance.`);
      setOpen(false);
      onDone();
    } catch (err) {
      setError(
        err instanceof EFError && err.code && GIFT_REFUSAL[err.code]
          ? GIFT_REFUSAL[err.code]
          : "Couldn't take it back. Try again.",
      );
      // A friend may have taken it meanwhile: read again either way.
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {trigger ? trigger(() => setOpen(true)) : (
      <button
        type="button"
        className={variant === "pill" ? PILL : FILLED}
        onClick={() => setOpen(true)}
        aria-label={variant === "pill" ? `Take back ${amount}` : undefined}
        data-gift-take-back
      >
        Take back
      </button>
      )}
      <LocalDialog open={open} onClose={() => (busy ? undefined : setOpen(false))} ariaLabel="Take back this gift">
        <div className="flex flex-col gap-3 p-5 text-center">
          <h2 className={SHEET_TITLE_CLASS}>Take back {amount}?</h2>
          <p className="text-muted-foreground type-body leading-relaxed">
            The link stops working and the credit is back in your balance at {place}.
          </p>
          {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}
          <div className="mt-1 flex flex-col gap-2">
            <button type="button" className={FILLED} onClick={() => void confirm()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {busy ? "Taking it back…" : "Take it back"}
            </button>
            <button type="button" className={OUTLINE} onClick={() => setOpen(false)} disabled={busy}>
              Keep it open
            </button>
          </div>
        </div>
      </LocalDialog>
    </>
  );
}
