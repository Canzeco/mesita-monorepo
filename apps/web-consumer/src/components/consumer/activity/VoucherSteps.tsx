"use client";

// A VOUCHER'S STEPS (MESITA-4627, Pato 2026-11-21): one vertical list, the
// current step lit in ink, the done ones ticked green, the rest muted.
//
//   voucher   Pay · Wait 3 hours · Receive it all      (CreditEntry, MESITA-4717)

import type { ComponentType } from "react";
import { Check } from "lucide-react";
import { Panel } from "@/components/shared/Panel";
import { cn } from "@/lib/utils";

export type VoucherStepState = "done" | "current" | undefined;

export type VoucherStep = {
  key: string;
  title: string;
  /** A second line under the title: "ready in 2 h 14 min". */
  sub?: string | null;
  amount?: string | null;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  state: VoucherStepState;
};

export function VoucherSteps({ steps }: { steps: VoucherStep[] }) {
  return (
    <Panel className="px-4 py-3" data-voucher-steps="">
      <ol className="flex flex-col" aria-label="Steps">
        {steps.map((st, i) => (
          <li key={st.key} className="flex gap-3" aria-current={st.state === "current" ? "step" : undefined} data-voucher-step={st.state ?? "todo"}>
            <span className="flex flex-col items-center" aria-hidden>
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  st.state === "current" ? "bg-foreground text-background" : st.state === "done" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-foreground",
                )}
              >
                {st.state === "done" ? <Check className="h-4 w-4" strokeWidth={2.75} /> : <st.Icon className="h-4 w-4" strokeWidth={2.25} />}
              </span>
              {i < steps.length - 1 ? <span className="bg-border my-1 w-0.5 flex-1" /> : null}
            </span>
            <span className={cn("flex min-w-0 flex-1 items-baseline justify-between gap-3 pt-1.5 text-sm font-semibold tabular-nums", i < steps.length - 1 && "pb-3", st.state === undefined && "text-muted-foreground")}>
              <span className="min-w-0">
                <span className="block">{`${i + 1}. ${st.title}`}</span>
                {st.sub ? <span className="text-muted-foreground block text-xs">{st.sub}</span> : null}
              </span>
              {st.amount ? <span className="shrink-0">{st.amount}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
