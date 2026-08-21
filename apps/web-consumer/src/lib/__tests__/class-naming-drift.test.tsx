import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CLASSES,
  CLASS_FLOOR,
  REACH_ENTRY_CLASS,
  isElevatedIdentity,
} from "@/lib/consumer-data";
import { InstagramConnectedSummary } from "@/components/consumer/me/class/InstagramConnectedSummary";

// Twice now a metal has been written into copy that renders for classes it
// does not describe: the Instagram sheet quoted one class's follower bar next
// to another class's name, and this summary printed "Silver active" on every
// connected handle — demoting an invited Diamond and promising Silver to an
// account that never cleared the bar. Both are naming bugs, so both are
// pinned by naming assertions rather than by snapshots.

describe("the reach entry rung is found by shape, not by name", () => {
  it("is the cheapest non-zero bar on the ladder", () => {
    const bars = CLASSES.map((c) => c.followerThreshold).filter((n) => n > 0);
    expect(REACH_ENTRY_CLASS.followerThreshold).toBe(Math.min(...bars));
  });

  it("still resolves to today's rung and bar", () => {
    expect(REACH_ENTRY_CLASS.id).toBe("silver");
    expect(REACH_ENTRY_CLASS.followerThreshold).toBe(1_000);
  });
});

describe("the connected summary names the class it was handed", () => {
  it.each(CLASSES)("$label reads back as $label", (cls) => {
    const html = renderToStaticMarkup(
      <InstagramConnectedSummary followers={0} classKey={cls.id} />,
    );
    expect(html).toContain(`${cls.label} active`);
    // ...and names no OTHER rung, which is the actual regression.
    for (const other of CLASSES.filter((c) => c.id !== cls.id)) {
      expect(html).not.toContain(`${other.label} active`);
    }
  });

  it("reports the follower count alongside the class when there is one", () => {
    const html = renderToStaticMarkup(
      <InstagramConnectedSummary followers={20_000} classKey="diamond" />,
    );
    expect(html).toContain("20,000 followers");
    expect(html).toContain("Diamond active");
  });
});

describe("the floor is found by shape, not by name", () => {
  it("is the one rung with no follower bar", () => {
    expect(CLASS_FLOOR.followerThreshold).toBe(0);
    const barless = CLASSES.filter((c) => c.followerThreshold === 0);
    expect(barless).toHaveLength(1);
  });

  it("sits below the entry rung — they are never the same class", () => {
    expect(CLASS_FLOOR.id).not.toBe(REACH_ENTRY_CLASS.id);
    expect(CLASS_FLOOR.followerThreshold).toBeLessThan(
      REACH_ENTRY_CLASS.followerThreshold,
    );
  });

  it("still resolves to today's rung", () => {
    expect(CLASS_FLOOR.id).toBe("bronze");
  });
});

describe("elevation is measured against the floor", () => {
  // The gate every elevated perk reads. It compared against a hardcoded
  // "bronze"; re-seating the floor would have left the perk unlocking off a
  // rung that no longer sits at the bottom.
  it("the floor on the free plan is the ONLY unelevated identity", () => {
    const unelevated = CLASSES.filter(
      (c) => !isElevatedIdentity({ cls: c.id, plan: "free" }),
    ).map((c) => c.id);
    expect(unelevated).toEqual([CLASS_FLOOR.id]);
  });

  it("Premium elevates every rung, the floor included", () => {
    for (const c of CLASSES) {
      expect(isElevatedIdentity({ cls: c.id, plan: "premium" })).toBe(true);
    }
  });
});
