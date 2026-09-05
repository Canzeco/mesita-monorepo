"use client";

// One row in either places list, plus its action. Claim and release are
// the same shape from the user's side — a row and one button — so they
// share a component and cannot drift apart visually.
import Link from "next/link";
import { useActionState } from "react";
import { cn } from "@/lib/utils";
import { PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { placePath } from "@/lib/business-route-contract";
import {
  claimPlaceAction,
  releasePlaceAction,
  type PlaceActionState,
} from "@/app/(shell)/actions/places";
import type { ConsolePlace } from "@/lib/api/organizations";

const INITIAL: PlaceActionState = { error: null };

export function PlaceRow({
  place,
  action,
  organizationId,
  allowed,
}: {
  place: ConsolePlace;
  action: "claim" | "release";
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

  return (
    <div className="border-border/60 flex items-center justify-between gap-3 border-b py-3.5 last:border-b-0">
      <div className="min-w-0">
        {action === "release" ? (
          <Link
            href={placePath(place.id)}
            className="truncate text-sm font-semibold hover:underline"
          >
            {place.name}
          </Link>
        ) : (
          <p className="truncate text-sm font-semibold">{place.name}</p>
        )}
        <p className="text-muted-foreground truncate text-[12px]">
          {place.address ?? place.zone ?? "No address"}
        </p>
        {state.error && (
          <p className="text-destructive mt-1 text-[12px]">{state.error}</p>
        )}
      </div>

      {allowed && (
        <form action={formAction} className="shrink-0">
          <input type="hidden" name="placeId" value={place.id} />
          <input type="hidden" name="organizationId" value={organizationId} />
          <button
            type="submit"
            disabled={pending}
            className={cn(
              PILL_BUTTON_CLASS,
              action === "release" &&
                "bg-card text-foreground border-border border",
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
        </form>
      )}
    </div>
  );
}
