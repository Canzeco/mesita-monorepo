// The Class sheet must never state a class it did not read.
//
// The shell layout catches a consumer-get-profile throw and renders degraded
// on purpose — its comment promises each page will surface its own error. The
// Class sheet could not: `normalize(null)` hands it FLOOR_CLASS, so a failed
// read and a real Bronze account produced the identical screen, with
// `aria-current="true"` asserting the guess to screen readers. An invited
// Diamond guest was told they were the floor.
//
// It fails CLOSED on permissions — the floor grants nothing — but WRONG on
// information, and information is all this surface renders. These tests pin
// the distinction, because the two states are one boolean apart and the wrong
// one is invisible in a screenshot.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ClassLadder } from "@/components/consumer/me/class/ClassLadder";
import { ClassProvider } from "@/lib/class-context";
import type { ConsumerClass } from "@/lib/api/profile";

const DIAMOND: ConsumerClass = {
  key: "aura", // the legacy key the bridge maps to diamond
  origin: "invitation",
  followers: 0,
  expires_at: null,
  subscription: null,
} as unknown as ConsumerClass;

function render(
  consumerClass: ConsumerClass | null,
  classUnavailable: boolean,
) {
  return renderToStaticMarkup(
    <ClassProvider
      consumerClass={consumerClass}
      classUnavailable={classUnavailable}
    >
      <ClassLadder />
    </ClassProvider>,
  );
}

describe("a class we read is stated", () => {
  it("marks the guest's rung current", () => {
    const html = render(DIAMOND, false);
    expect(html).toContain('aria-current="true"');
  });

  it("marks exactly one rung, never two", () => {
    const html = render(DIAMOND, false);
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
  });

  it("a real Bronze account still gets its rung", () => {
    // The floor is a legitimate class. Only a FAILED READ is not.
    const html = render(null, false);
    expect(html).toContain('aria-current="true"');
  });
});

describe("a class we could not read is not stated", () => {
  it("asserts no rung to the accessibility tree", () => {
    const html = render(null, true);
    expect(html).not.toContain("aria-current");
  });

  it("still draws all four rungs — what the classes ARE stays true", () => {
    const html = render(null, true);
    for (const label of ["Bronze", "Silver", "Gold", "Diamond"]) {
      expect(html).toContain(label);
    }
  });

  it("unlocks nothing — a failed read never grants a rung", () => {
    // `unlocked` drives the solid metal tile. Degraded must not hand out the
    // earned treatment on a class nobody confirmed.
    const degraded = render(null, true);
    const known = render(null, false);
    expect(degraded).not.toBe(known);
  });

  it("a degraded read of a Diamond account claims nothing", () => {
    // The case that motivated this: the highest-value consumer, told they are
    // the floor. Degraded wins over whatever class data happens to be present.
    const html = render(DIAMOND, true);
    expect(html).not.toContain("aria-current");
  });
});

describe("only the CURRENT class is coloured", () => {
  // Bronze's followerThreshold is 0, so `followers >= threshold` is true for
  // every guest. That made Bronze permanently "unlocked" and permanently
  // painted: a Diamond guest saw their own blue row with a solid BRONZE tile
  // two rows above it. Colour means class, so it has to mean YOUR class.
  it("a Diamond guest sees no bronze anywhere", () => {
    const html = render(DIAMOND, false);
    expect(html).not.toContain("bg-tier-bronze");
  });

  it("paints exactly one metal — the current rung's card", () => {
    const html = render(DIAMOND, false);
    expect(html.match(/bg-tier-/g)).toHaveLength(1);
    expect(html).toContain("bg-tier-diamond");
  });

  it("a Bronze guest paints bronze, and only bronze", () => {
    const html = render(null, false); // floor = bronze
    expect(html.match(/bg-tier-/g)).toHaveLength(1);
    expect(html).toContain("bg-tier-bronze");
  });

  it("paints nothing at all when the class was never read", () => {
    expect(render(DIAMOND, true).match(/bg-tier-/g)).toBeNull();
  });
});
