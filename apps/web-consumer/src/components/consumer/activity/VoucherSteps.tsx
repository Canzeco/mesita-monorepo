"use client";

// A TICKET'S STEPS (MESITA-4627, Pato 2026-11-21): one vertical list, the
// current step lit in ink, the done ones ticked green, the rest muted. Every
// ticket wears Pato's own step titles (MESITA-4747, 2026-11-23):
//
//   voucher   Pay · Wait 3 hours · Get Bonus                     (CreditEntry)
//   visit     Pay · Wait 1 hour · Get Back                      (VisitSummary)
//
// The story ticket's steps left with Instagram Stories (MESITA-4766).
// A step can fail: an X on grey, its title in ink, the plain reason as its
// sub line; the steps after it stay muted.
// Grey, never red: nothing on a ticket reads red (TicketParts).

import type { ComponentType } from "react";
import { Check, X } from "lucide-react";
import { Panel } from "@/components/shared/Panel";
import { cn } from "@/lib/utils";

export type VoucherStepState = "done" | "current" | "failed" | undefined;

export type VoucherStep = {
  key: string;
  title: string;
  /** A second line under the title: "ready in 2 h 14 min". */
  sub?: string | null;
  amount?: string | null;
  /** The amount in green: credit that landed (MESITA-4747). */
  amountTone?: "green";
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  state: VoucherStepState;
};

/** A wait step's line (MESITA-4747): "ready in 9 h 41 min", "ready in
 *  2 min", "ready in under a minute". */
export function readyIn(atMs: number, nowMs: number): string {
  const mins = Math.ceil((atMs - nowMs) / 60_000);
  if (mins <= 1) return "ready in under a minute";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `ready in ${h} h${m > 0 ? ` ${m} min` : ""}` : `ready in ${m} min`;
}

export function VoucherSteps({ steps }: { steps: VoucherStep[] }) {
  return (
    <Panel className="px-4 py-3" data-voucher-steps="">
      <ol className="flex flex-col" aria-label="Steps">
        {steps.map((st, i) => (
          <li key={st.key} className="flex gap-3" aria-current={st.state === "current" || st.state === "failed" ? "step" : undefined} data-voucher-step={st.state ?? "todo"}>
            <span className="flex flex-col items-center" aria-hidden>
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  st.state === "current"
                    ? "bg-foreground text-background"
                    : st.state === "done"
                      ? "bg-emerald-50 text-emerald-700"
                      : st.state === "failed"
                        ? "bg-muted text-muted-foreground"
                        : "bg-muted text-foreground",
                )}
              >
                {st.state === "done" ? (
                  <Check className="h-4 w-4" strokeWidth={2.75} />
                ) : st.state === "failed" ? (
                  <X className="h-4 w-4" strokeWidth={2.75} />
                ) : (
                  <st.Icon className="h-4 w-4" strokeWidth={2.25} />
                )}
              </span>
              {i < steps.length - 1 ? <span className="bg-border my-1 w-0.5 flex-1" /> : null}
            </span>
            <span className={cn("flex min-w-0 flex-1 items-baseline justify-between gap-3 pt-1.5 text-sm font-semibold tabular-nums", i < steps.length - 1 && "pb-3", st.state === undefined && "text-muted-foreground")}>
              <span className="min-w-0">
                <span className="block">{`${i + 1}. ${st.title}`}</span>
                {st.sub ? <span className="text-muted-foreground block text-xs">{st.sub}</span> : null}
              </span>
              {st.amount ? <span className={cn("shrink-0", st.amountTone === "green" && "text-green-700")}>{st.amount}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
