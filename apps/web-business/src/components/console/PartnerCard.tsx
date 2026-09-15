"use client";

// The Organization screen's Partner switch (MESITA-1798).
//
// Same grammar as a Capabilities ladder row: the WHOLE ROW is the
// `role="switch"` button, the track is a plain span inside it. Label is
// Partner — on or off. Never "Not Partner", never "Patner".
//
// Stripe Ready is the lock. Owner-only to flip; everyone else reads it. The
// lock hides nothing: every branch renders the same track and one line
// (MESITA-1864).
//
// THE BOX NAMES NO CAPABILITY (MESITA-1863). Pato: *"the rewards and more
// shit is not inherent of the partnership — or if it's not, don't mention it
// there."* It listed Mesita Pay, Visit Rewards and Accept Prepays under the
// on switch, and not one of them arrives with it: joining writes `partnered`
// and `mesita_pay_enabled`, and puts every held place on plan=pro at ZERO
// rates — rewards off, prepays off, and Mesita Pay still behind a
// charge-ready Stripe account. All three are partner-GATED; none is
// partner-DELIVERED, so a list under the switch promised what the operator
// then found switched off on Capabilities.
//
// The ladder is where a capability states its own prerequisite
// (place-manage/sections/controls/offerings.ts). This box says what flipping
// the switch DOES, and stops.
//
// THE 9.5rem RIGHT WELL IS GONE (MESITA-1861). Every branch used to end in
// `w-[9.5rem] shrink-0 justify-end sm:w-[11rem]`, which pinned the track (or
// the lock pill) to the far right of a card that, on the fluid console, is
// ~1690px wide — with its own sentence pinned to the far left. Two atoms, one
// desert. The well existed to line the three branches up with each other; the
// Section lane does that job now, for every box on the page at once, so what
// is left is the control and its sentence sitting next to each other.

import { useState, useTransition } from "react";
import { Loader2, Lock } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { setOrgPartnershipAction } from "@/app/(shell)/actions/organizations";
import { cn } from "@/lib/utils";

function Track({
  on,
  busy,
  locked = false,
}: {
  on: boolean;
  busy: boolean;
  /** Stripe is not Ready. The switch still renders — off, dimmed, and
   *  carrying the lock in the knob (MESITA-1864). */
  locked?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        locked ? "bg-muted-foreground/15" : on ? "bg-secondary" : "bg-muted-foreground/25",
      )}
    >
      <span
        className={cn(
          "inline-flex h-5 w-5 transform items-center justify-center rounded-full transition-transform",
          on ? "translate-x-[22px]" : "translate-x-0.5",
          // A locked knob carries no shadow: shadow is what makes the thumb
          // look liftable, and this one is not.
          locked ? "bg-muted" : "bg-background shadow",
        )}
      >
        {busy && <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />}
        {locked && !busy && <Lock className="text-muted-foreground h-3 w-3" aria-hidden />}
      </span>
    </span>
  );
}

export function PartnerCard({
  orgId,
  partnered,
  stripeReady,
  isOwner,
}: {
  orgId: string;
  partnered: boolean;
  stripeReady: boolean;
  isOwner: boolean;
}) {
  const [on, setOn] = useState(partnered);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const locked = !stripeReady;
  const canFlip = isOwner && !locked && !pending;

  const toggle = () => {
    if (!canFlip) return;
    const next = !on;
    setOn(next);
    setError(null);
    start(async () => {
      const r = await setOrgPartnershipAction(orgId, next);
      if (r.error) {
        setOn(!next);
        setError(r.error);
        return;
      }
      setOn(r.partnered);
    });
  };

  return (
    <div className="flex flex-col">
      {locked ? (
        // THE SWITCH SHOWS WHILE IT IS LOCKED (MESITA-1864). Pato, on an org
        // whose Stripe account is Restricted: "show here like a toggle or
        // something." This branch used to render a pill and a sentence where
        // the other two render a control — so the one state every new
        // organization meets was the one that never showed what Partnership
        // is: a thing you turn on. Now all three are a track and a line.
        //
        // The pill went with it. Switch + pill + sentence is three atoms for
        // one fact: the dimmed track says "not available", the sentence says
        // why, and `role="switch"` + `aria-disabled` says both to a reader.
        <div
          role="switch"
          aria-checked={false}
          aria-disabled
          aria-label="Partner"
          className="flex items-center gap-3 py-1"
        >
          <Track on={false} busy={false} locked />
          <span className="text-muted-foreground min-w-0 text-xs leading-snug">
            Needs a Ready Stripe account — connect Stripe first.
          </span>
        </div>
      ) : canFlip || pending ? (
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Partner"
          disabled={pending}
          onClick={toggle}
          className={cn(
            "flex w-full items-center gap-3 py-1 text-left transition",
            pending ? "cursor-default opacity-60" : "cursor-pointer hover:opacity-90",
          )}
        >
          <Track on={on} busy={pending} />
          <span className="text-muted-foreground min-w-0 text-xs leading-snug">
            {on
              ? "Every place this organization holds is in the partnership."
              : "Turn on to join every held place."}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3 py-1" aria-label="Partner">
          <Track on={on} busy={false} />
          <span className="text-muted-foreground min-w-0 text-xs leading-snug">
            {on
              ? "Every place this organization holds is in the partnership."
              : "An owner turns this on."}
          </span>
        </div>
      )}

      <div aria-live="polite">
        {error && (
          <div className="pt-2">
            <ErrorNote message={error} />
          </div>
        )}
      </div>
    </div>
  );
}
