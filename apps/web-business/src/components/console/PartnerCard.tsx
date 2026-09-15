"use client";

// The Organization screen's Partner switch (MESITA-1798).
//
// Same grammar as a Capabilities ladder row: the WHOLE ROW is the
// `role="switch"` button, the track is a plain span inside it. Label is
// Partner — on or off. Never "Not Partner", never "Patner".
//
// Stripe Ready is the lock. Owner-only to flip; everyone else reads it.
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

/** What being a Partner unlocks at each place — Capabilities still owns
 *  the per-place switches; this box names them so the org toggle is not
 *  a flag without a consequence. */
export const PARTNER_CAPABILITIES = [
  { label: "Mesita Pay", detail: "The payments package, on for this organization." },
  { label: "Visit Rewards", detail: "Each place picks Zero, Conservative or Aggressive." },
  { label: "Accept Prepays", detail: "Redeem a guest's prepaid balance on the bill." },
] as const;

function Track({ on, busy }: { on: boolean; busy: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        on ? "bg-secondary" : "bg-muted-foreground/25",
      )}
    >
      <span
        className={cn(
          "bg-background inline-flex h-5 w-5 transform items-center justify-center rounded-full shadow transition-transform",
          on ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      >
        {busy && <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />}
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
        // The Section above is titled "Partner" and says what it unlocks;
        // repeating the word and the sentence here was saying one thing three
        // times (MESITA-1847). The span carried this branch's only accessible
        // name, so the label moves onto the row itself.
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 py-1"
          aria-label="Partner"
        >
          <span className="text-muted-foreground bg-muted type-label inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold">
            <Lock className="h-3 w-3" aria-hidden />
            Needs a Ready Stripe account
          </span>
          <span className="text-muted-foreground min-w-0 text-xs leading-snug">
            Connect Stripe first.
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

      {on && (
        <ul className="border-border/60 mt-3 flex flex-col gap-2 border-t pt-3">
          {PARTNER_CAPABILITIES.map((c) => (
            <li key={c.label} className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-sm font-medium">{c.label}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                  {c.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
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
