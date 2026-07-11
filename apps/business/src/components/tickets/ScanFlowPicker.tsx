"use client";

import { cn } from "@/lib/utils";
import {
  FLOW_TYPE_SHORT_LABELS,
  type TicketFlowType,
} from "@/lib/ticket-staff-lifecycle";

const FLOW_TYPES: TicketFlowType[] = ["A", "B"];

export function ScanFlowPicker({
  value,
  onChange,
}: {
  value: TicketFlowType;
  onChange: (flow: TicketFlowType) => void;
}) {
  return (
    <div
      className="bg-muted/50 border-border/60 flex flex-wrap gap-1 rounded-xl border p-1"
      role="radiogroup"
      aria-label="Ticket flow"
    >
      {FLOW_TYPES.map((t) => {
        const selected = value === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(t)}
            className={cn(
              "flex min-w-[3.25rem] flex-1 flex-col items-center rounded-lg px-2 py-2 transition",
              selected
                ? "bg-card text-foreground ring-border/80 shadow-sm ring-1"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="text-[13px] font-semibold">
              {FLOW_TYPE_SHORT_LABELS[t]}
            </span>
            <span className="text-muted-foreground mt-0.5 max-w-full truncate text-[9px] leading-tight font-medium tracking-wide uppercase">
              Type {t}
            </span>
          </button>
        );
      })}
    </div>
  );
}
