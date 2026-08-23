"use client";

import { DemoBox, DemoSwitch } from "@/components/consumer/me/demo/DemoBox";
import { setMockAccount, useMockAccount } from "@/lib/class-context";
import { DEMO_INSTAGRAM_FOLLOWERS } from "@/lib/instagram-demo";

// The Instagram axis of the emulator — a connected account with a follower
// count, which is what actually decides the class the ladder shows. Its switch
// rides the DemoBox header row because "connected or not" is a state, not a
// choice between named rungs; the count only exists once it is on.

export function InstagramEmulator() {
  const mock = useMockAccount();
  const igOn = mock?.instagram ?? false;
  const followers = mock?.followers ?? DEMO_INSTAGRAM_FOLLOWERS;

  return (
    <DemoBox
      label="Preview connected"
      action={
        <DemoSwitch
          checked={igOn}
          ariaLabel="Preview connected Instagram"
          onToggle={() =>
            setMockAccount(
              igOn
                ? { instagram: false }
                : { instagram: true, followers: DEMO_INSTAGRAM_FOLLOWERS },
            )
          }
        />
      }
    >
      {igOn && (
        <div className="flex items-center gap-2">
          <label
            htmlFor="mock-ig-followers"
            className="text-muted-foreground type-label font-medium"
          >
            Demo count
          </label>
          <input
            id="mock-ig-followers"
            inputMode="numeric"
            value={followers}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^\d]/g, ""));
              setMockAccount({ followers: Number.isFinite(n) ? n : 0 });
            }}
            className="border-border bg-muted/30 h-8 w-24 rounded-lg border px-2.5 text-right text-xs font-semibold outline-none"
          />
          <span className="text-muted-foreground type-meta ml-auto">
            Class preview uses this
          </span>
        </div>
      )}
    </DemoBox>
  );
}
