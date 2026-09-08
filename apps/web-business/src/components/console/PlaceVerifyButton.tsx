"use client";

// Verify — the ownership proof, as a row-level control.
//
// It sits next to Claim / Release because it is the other half of the same
// ceremony: an organization takes a place, then proves it holds it. It is
// NOT offered on a place nobody holds (claim first) and NOT offered on one
// already verified (Verified never lapses, so there is nothing to redo).
//
// The code box only appears once you ask for it. A permanently-open input on
// every row would read as a required step for all of them, when most rows
// need nothing.
import { useActionState, useState } from "react";
import { cn } from "@/lib/utils";
import { INPUT_CLASS, PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import {
  verifyPlaceAction,
  type PlaceVerifyActionState,
} from "@/app/(shell)/actions/places";

const INITIAL: PlaceVerifyActionState = { error: null, note: null };

export function PlaceVerifyButton({
  placeId,
  allowed,
}: {
  placeId: string;
  /** False when the caller's org role may not verify. Hidden rather than
   *  shown-and-rejected, same law as PlaceHoldButton: the EF would 403, and
   *  a control that cannot work is worse than no control. */
  allowed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    verifyPlaceAction,
    INITIAL,
  );

  if (!allowed) return null;

  // The note is terminal: once it verifies, the row re-renders without this
  // control at all, so the note only shows in the "already verified" case.
  if (state.note) {
    return (
      <span className="text-muted-foreground shrink-0 text-[12px]">
        {state.note}
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          PILL_BUTTON_CLASS,
          "bg-card text-foreground border-border border",
        )}
      >
        Verify
      </button>
    );
  }

  return (
    <form action={formAction} className="shrink-0 text-right">
      <input type="hidden" name="placeId" value={placeId} />
      <span className="inline-flex items-center gap-2">
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Code"
          aria-label="Verification code"
          autoFocus
          className={cn(INPUT_CLASS, "h-8 w-[92px] text-[13px]")}
        />
        <button
          type="submit"
          disabled={pending}
          className={cn(PILL_BUTTON_CLASS)}
        >
          {pending ? "Verifying..." : "Confirm"}
        </button>
      </span>
      {state.error && (
        <p className="text-destructive mt-1 text-[12px]">{state.error}</p>
      )}
    </form>
  );
}
