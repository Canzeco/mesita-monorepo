// The ladder's home (Design D1): three steps, current rung highlighted,
// one next-step line. This is the org home's anchor — the progression
// moment the console is selling.
import { cn } from "@/lib/utils";
import type { Rung } from "@/lib/model/types";

const STEPS: { rung: Rung; label: string }[] = [
  { rung: "listed", label: "Listed" },
  { rung: "verified", label: "Verified" },
  { rung: "partner", label: "Partner" },
];

const NEXT_STEP: Record<Rung, string> = {
  listed: "Next: prove you own a place to unlock the console.",
  verified: "Next: connect payments to fund rewards and take money.",
  partner: "Payments live. Rewards, Credits and orders are yours to run.",
};

export function RungStrip({ rung }: { rung: Rung }) {
  const currentIdx = STEPS.findIndex((s) => s.rung === rung);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {STEPS.map((step, i) => (
          <div key={step.rung} className="flex items-center gap-2">
            {i > 0 && <div className="bg-border h-px w-6" />}
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-semibold",
                i < currentIdx && "bg-muted text-muted-foreground",
                i === currentIdx && "bg-foreground text-background",
                i > currentIdx &&
                  "border-border text-muted-foreground border border-dashed",
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-[12px]">{NEXT_STEP[rung]}</p>
    </div>
  );
}
