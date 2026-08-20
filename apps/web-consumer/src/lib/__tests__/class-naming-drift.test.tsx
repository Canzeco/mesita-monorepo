import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { CLASSES, REACH_ENTRY_CLASS } from "@/lib/consumer-data";
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
