"use client";

import {
  useConsumerClass,
  setMockAccount,
  type MockAccount,
} from "@/lib/class-context";
import { cn } from "@/lib/utils";

// Dev/demo affordance — flip the signed-in consumer between the four class
// states (Standard / Influencer via Instagram / Premium via subscription /
// Aura via invitation, rate-ladder order) so every surface that reads
// useConsumerClass() can be previewed without real billing or Instagram
// reach. Writes the client-only MOCK_ACCOUNT override (class axis) and
// switches the Instagram emulation off so the picked class always shows (a
// qualifying IG emulation would otherwise win, like the real claim EF).
// Remove with the MOCK_ paths once the states can be produced with real data.
const CLASS_PREVIEW_OPTIONS: {
  value: NonNullable<MockAccount["class"]>;
  label: string;
}[] = [
  { value: "standard", label: "Standard" },
  { value: "influencer", label: "Influencer" },
  { value: "premium", label: "Premium" },
  { value: "aura", label: "Aura" },
];

export function ClassPreviewToggle() {
  const { key } = useConsumerClass();

  return (
    <div className="border-border/70 rounded-2xl border border-dashed p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em] text-amber-600 uppercase">
          Demo
        </span>
        <span className="text-muted-foreground text-[11px] font-medium">
          Preview
        </span>
      </div>
      <div className="bg-muted/60 flex rounded-lg p-1">
        {CLASS_PREVIEW_OPTIONS.map((o) => {
          const active = key === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() =>
                setMockAccount({ class: o.value, instagram: false })
              }
              aria-pressed={active}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-center text-[12px] font-semibold whitespace-nowrap transition",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
