"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlaceFormState } from "./place-form-types";
import { getProfileProgress } from "./place-profile-progress";

export function PlaceProfileCompletionBar({
  v,
  alwaysShow = false,
}: {
  v: PlaceFormState;
  alwaysShow?: boolean;
}) {
  const { pct, isComplete } = getProfileProgress(v);

  if (!alwaysShow && isComplete) return null;

  return (
    <div role="status" aria-label={`Profile ${pct}% complete`} className="pb-1">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px]">Profile</span>
        <span className="text-[11px] font-medium tabular-nums">{pct}%</span>
      </div>
      <div className="bg-muted h-1 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            isComplete ? "bg-emerald-500" : "bg-pink-gradient",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function PlaceProfileProgressPanel({ v }: { v: PlaceFormState }) {
  const { checks, pct, isComplete } = getProfileProgress(v);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold tabular-nums">{pct}%</span>
          <span className="text-muted-foreground text-[11px]">
            {isComplete ? "Profile complete" : "Profile in progress"}
          </span>
        </div>
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              isComplete ? "bg-emerald-500" : "bg-pink-gradient",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2">
        {checks.map(({ label, done }) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-medium",
              done
                ? "border-emerald-500/25 bg-emerald-500/5 text-foreground"
                : "border-border/60 bg-muted/20 text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                done ? "bg-emerald-500 text-white" : "bg-muted",
              )}
            >
              {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
            </span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
