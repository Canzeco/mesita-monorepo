"use client";

// Claim and release — one button, wherever a place is shown.
//
// Both lists and the Place screen offer the same two moves, so they share
// this component and cannot drift apart: the same wording, the same
// pending copy, the same failure surfaced in the same place.
import { useActionState } from "react";
import { cn } from "@/lib/utils";
import { GHOST_PILL_BUTTON_CLASS, PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import {
  claimPlaceAction,
  releasePlaceAction,
  type PlaceActionState,
} from "@/app/(shell)/actions/places";

const INITIAL: PlaceActionState = { error: null };

export function PlaceHoldButton({
  action,
  placeId,
  organizationId,
  allowed,
}: {
  action: "claim" | "release";
  placeId: string;
  organizationId: string;
  /** False when the caller's org role may not perform this action. The
   *  button is hidden rather than shown-and-rejected: the EF would 403,
   *  and offering a control that cannot work is worse than omitting it. */
  allowed: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    action === "claim" ? claimPlaceAction : releasePlaceAction,
    INITIAL,
  );

  if (!allowed) return null;

  return (
    <form action={formAction} className="shrink-0 text-right">
      <input type="hidden" name="placeId" value={placeId} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <button
        type="submit"
        disabled={pending}
        className={cn(
          // Release is the destructive-ish half: it hands the place back to
          // anyone. Ghost, so it never reads as the obvious next step —
          // Claim stays the one solid pill in the row.
          action === "release" ? GHOST_PILL_BUTTON_CLASS : PILL_BUTTON_CLASS,
        )}
      >
        {pending
          ? action === "claim"
            ? "Claiming..."
            : "Releasing..."
          : action === "claim"
            ? "Claim"
            : "Release"}
      </button>
      {state.error && (
        <p className="text-destructive mt-1 text-[12px]">{state.error}</p>
      )}
    </form>
  );
}
