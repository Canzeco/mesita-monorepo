"use client";

// Claim and release — one button, wherever a place is shown.
//
// Both lists and the Place screen offer the same two moves, so they share
// this component and cannot drift apart: the same wording, the same
// pending copy, the same failure surfaced in the same place.
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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

  // Tell the rail the portfolio moved. The rail draws its places from the
  // organization list the SHELL LAYOUT fetched (MESITA-1779), and
  // `revalidatePath` in the action re-renders the current route, so one
  // explicit `router.refresh()` here is what re-runs that layout and hands
  // the rail the place you just claimed — no client refetch, no reload.
  //
  // The signal is the pending edge, not `state`: a successful claim returns
  // `{ error: null }`, which is byte-identical to the initial state, so there
  // is nothing in `state` to watch. Pending going true-then-false IS the
  // completion, and a failed action costs one harmless refresh.
  const router = useRouter();
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) router.refresh();
    wasPending.current = pending;
  }, [pending, router]);

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
