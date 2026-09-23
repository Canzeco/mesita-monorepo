"use client";

import { DemoBox, DemoSwitch } from "@/components/consumer/me/demo/DemoBox";
import { setMockAccount, useMockAccount } from "@/lib/class-context";

// The Diamond List axis of the emulator — on the list or not, and nothing in
// between (MESITA-2040, named MESITA-2044).
//
// IT IS A SWITCH NOW, NOT A SEGMENTED PICKER. `ClassPreviewToggle` offered
// four buttons because the thing it previewed was a four-value enum, and it
// had to switch the Instagram emulation OFF on every press so a qualifying
// follower count could not outrank the class you picked. Neither problem
// exists: the fact is binary, and it shares no field with Instagram, so both
// emulators can be on at once and the preview is simply both.

export function DiamondEmulator() {
  const mock = useMockAccount();
  const on = mock?.diamond ?? false;

  return (
    <DemoBox
      label="Preview the Diamond List"
      action={
        <DemoSwitch
          checked={on}
          ariaLabel="Emulate the Diamond List"
          onToggle={() => setMockAccount({ diamond: !on })}
        />
      }
    />
  );
}
