"use client";

import {
  useConsumerClass,
  useMockClass,
  setMockClass,
  type MockClass,
} from "@/lib/class-context";
import { cn } from "@/lib/utils";

// Dev/demo affordance — flip the signed-in consumer between the three class
// states (Free / Premium via subscription / Premium via Instagram) so every
// surface that reads useConsumerClass() can be previewed without real billing
// or a 1K-follower Instagram. Writes a client-only localStorage override that
// wins over the real server-seeded class. Remove with the MOCK_ paths once the
// three states can be produced with real data.
const CLASS_PREVIEW_OPTIONS: { value: MockClass; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "subscription", label: "Subscription" },
  { value: "instagram", label: "Instagram" },
];

export function ClassPreviewToggle() {
  const override = useMockClass();
  const { key, origin } = useConsumerClass();
  const selected: MockClass =
    override ??
    (key === "free"
      ? "free"
      : origin === "instagram"
        ? "instagram"
        : "subscription");

  return (
    <div className="border-border/70 rounded-2xl border border-dashed p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em] text-amber-600 uppercase">
          Demo
        </span>
        <span className="text-muted-foreground text-[11px] font-medium">
          Preview class state
        </span>
      </div>
      <div className="bg-muted/60 flex rounded-lg p-1">
        {CLASS_PREVIEW_OPTIONS.map((o) => {
          const active = selected === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setMockClass(o.value)}
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
