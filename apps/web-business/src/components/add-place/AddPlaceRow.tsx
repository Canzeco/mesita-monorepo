"use client";

// ONE SEARCH RESULT, as one full-width row (MESITA-1850).
//
// The place, its address, WHAT MESITA ALREADY KNOWS ABOUT IT, and the one
// button that acts on that. Pato: "display if the place is already on mesita
// or if its not, and put the shitty button to claim/verify all the fucking
// workflow." Every fact and every verb on one line, so the operator reads
// down the list and clicks once.
//
// THE STATE IS A WORD, NOT A COLOUR. "Not on Mesita" and "On Mesita" are the
// two answers an operator came for; a green dot would make them guess. The
// pill is neutral in every state — the BUTTON is the only thing that changes
// weight, because the button is the only thing that does something.
//
// A ROW WITH NO BUTTON IS FINISHED, NOT BROKEN. A place another organization
// holds renders its state and stops; every action would 409, and a disabled
// button that explains nothing is worse than no button at all.
//
// ── A RESULT IS A CARD (MESITA-1873) ──────────────────────────────────────
//
// Pato, on the live list: *"prettier results wtf."* The content was right and
// the CONTAINER was not: hairline-separated rows sitting directly on the
// page's own ground, which is the one surface in this console that is not
// white. Against the product tiles that shipped the same morning — rounded,
// lifted, on `bg-card` — the search results read as a table somebody had not
// finished styling.
//
// So a result takes `Section`'s geometry, which is the console's card: the
// same radius, the same border, the same `shadow-card` lift, the same 16px
// padding. The list becomes a gapped column instead of a divided block. The
// card lifts a little further on hover, because every one of these rows is
// something you are about to click.
//
// NOTHING ABOUT THE CONTENT MOVED. The place, its address, what Mesita
// already knows and the one verb are still on one line, the state pill is
// still neutral in all five states, and the button is still the only thing
// that changes weight.
import Link from "next/link";
import { Loader2, Store } from "lucide-react";
import type { RowState } from "@/lib/add-place-card";
import type { PlacePrediction } from "@/lib/api/place-search";
import { placeHref } from "@/lib/console-routes";
import { GHOST_PILL_BUTTON_CLASS, PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

/** The neutral state pill. One shape for all five answers — the row's rank
 *  comes from its button, never from a colour the operator has to decode. */
const STATE_PILL =
  "border-border text-muted-foreground shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold";

export function AddPlaceRow({
  prediction,
  state,
  canAdd,
  pending,
  error,
  onCreate,
  onClaim,
}: {
  prediction: PlacePrediction;
  /** Null while this row's lookup is still in flight. */
  state: RowState | null;
  canAdd: boolean;
  pending: boolean;
  error: string | null;
  onCreate: () => void;
  onClaim: (placeId: string) => void;
}) {
  return (
    <li className="border-border bg-card shadow-card hover:border-foreground/20 flex flex-col gap-2 rounded-2xl border p-4 transition sm:flex-row sm:items-center sm:gap-4">
      <span
        aria-hidden
        className="bg-muted text-muted-foreground hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex"
      >
        <Store className="h-4 w-4" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">
          {prediction.mainText}
        </span>
        {prediction.secondaryText ? (
          <span className="text-muted-foreground truncate text-[13px]">
            {prediction.secondaryText}
          </span>
        ) : null}
        {error ? (
          <span role="alert" className="text-destructive mt-1 text-[12px]">
            {error}
          </span>
        ) : null}
      </span>

      {/* The state, then the verb. Reserved width so the buttons line up down
          the list instead of dancing with each label's length. */}
      <span className="flex shrink-0 items-center gap-3 sm:w-[19rem] sm:justify-end">
        {state === null ? (
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[12px]">
            <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
            Checking Mesita
          </span>
        ) : (
          <>
            <span className={STATE_PILL}>{state.label}</span>
            {state.kind === "create" && canAdd && (
              <button
                type="button"
                onClick={onCreate}
                disabled={pending}
                className={PILL_BUTTON_CLASS}
              >
                {pending ? "Creating…" : "Create"}
              </button>
            )}
            {state.kind === "claim" && canAdd && (
              <button
                type="button"
                onClick={() => onClaim(state.place.id)}
                disabled={pending}
                className={PILL_BUTTON_CLASS}
              >
                {pending ? "Claiming…" : "Claim"}
              </button>
            )}
            {(state.kind === "open" || state.kind === "pending") && (
              <Link href={placeHref(state.placeId)} className={GHOST_PILL_BUTTON_CLASS}>
                Open
              </Link>
            )}
          </>
        )}
      </span>
    </li>
  );
}

/** The bar's own empty line — what to do, in one sentence, with no form
 *  around it. An empty state is a feature: this one names the two outcomes
 *  so the first result is never a surprise. */
export function AddPlaceHint({ className }: { className?: string }) {
  return (
    <p className={cn("text-muted-foreground text-sm", className)}>
      Type the place&apos;s name. Already on Mesita, claim it. If it is not,
      create it.
    </p>
  );
}
