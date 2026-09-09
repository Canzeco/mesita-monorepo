"use client";

// Verify — one click, on a place the organization already holds.
//
// It sits next to Claim / Release because it is the other half of the same
// ceremony: an organization takes a place, then it becomes Verified. It is
// NOT offered on a place nobody holds (claim first) and NOT offered on one
// already verified (Verified never lapses, so there is nothing to redo).
//
// There is no code box. The mock 123456 that used to sit here proved nothing
// and cost a typing step; the real proof (phone OTP) will arrive as its own
// challenge in front of this call, not as a resurrected input.
import { useActionState } from "react";
import { GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";
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

  return (
    <form action={formAction} className="shrink-0 text-right">
      <input type="hidden" name="placeId" value={placeId} />
      <button
        type="submit"
        disabled={pending}
        className={GHOST_PILL_BUTTON_CLASS}
      >
        {pending ? "Verifying..." : "Verify"}
      </button>
      {state.error && (
        <p className="text-destructive mt-1 text-[12px]">{state.error}</p>
      )}
    </form>
  );
}
