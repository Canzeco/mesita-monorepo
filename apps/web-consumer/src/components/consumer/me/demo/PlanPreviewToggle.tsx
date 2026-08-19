"use client";

import { DemoBox, DemoSegmented } from "@/components/consumer/me/demo/DemoBox";
import { setMockAccount, useConsumerClass } from "@/lib/class-context";
import type { PlanKey } from "@/lib/consumer-data";

// The PLAN axis of the same emulator — the twin of ClassPreviewToggle, on the
// plan sheet. Premium was previewable only by editing the mock blob by hand,
// so the one surface that changes shape with the plan (perks, checkout button
// vs. the renewal note) was the hardest one to see in both states.
//
// Class is not folded in: the two axes are independent, and each sheet
// previews its own.
const PLAN_PREVIEW_OPTIONS: readonly { value: PlanKey; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "premium", label: "Premium" },
];

export function PlanPreviewToggle() {
  const { plan } = useConsumerClass();

  return (
    <DemoBox label="Preview">
      <DemoSegmented
        options={PLAN_PREVIEW_OPTIONS}
        value={plan}
        onSelect={(value) => setMockAccount({ premium: value === "premium" })}
      />
    </DemoBox>
  );
}
