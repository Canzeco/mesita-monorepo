"use client";

import { DemoBox, DemoSegmented } from "@/components/consumer/me/demo/DemoBox";
import { setMockAccount, useConsumerClass } from "@/lib/class-context";
import type { MockAccount } from "@/lib/class-context";

// Flip the signed-in consumer between the four CLASS states (Bronze / Silver +
// Gold via Instagram reach / Diamond via a direct invitation, ladder order) so
// every surface that reads useConsumerClass() can be previewed without real
// Instagram reach. Writes the client-only MOCK_ACCOUNT override (class axis)
// and switches the Instagram emulation off so the picked class always shows —
// a qualifying IG emulation would otherwise win, like the real claim EF.
//
// The PLAN axis is deliberately not folded in here: it is independent, so one
// control would need eight buttons instead of four. It has its own box on the
// plan sheet — see PlanPreviewToggle.
const CLASS_PREVIEW_OPTIONS: readonly {
  value: NonNullable<MockAccount["class"]>;
  label: string;
}[] = [
  { value: "bronze", label: "Bronze" },
  { value: "silver", label: "Silver" },
  { value: "gold", label: "Gold" },
  { value: "diamond", label: "Diamond" },
];

export function ClassPreviewToggle() {
  const { key } = useConsumerClass();

  return (
    <DemoBox label="Preview">
      <DemoSegmented
        options={CLASS_PREVIEW_OPTIONS}
        value={key}
        onSelect={(value) => setMockAccount({ class: value, instagram: false })}
      />
    </DemoBox>
  );
}
