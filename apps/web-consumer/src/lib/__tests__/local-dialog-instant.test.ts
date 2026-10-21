import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// LocalDialog's `instant` (MESITA-2546): the person card appears and
// disappears at once; every other dialog keeps its fade and scale.
const SRC = readFileSync(
  join(__dirname, "../../components/consumer/overlay/LocalOverlay.tsx"),
  "utf8",
);

describe("LocalDialog instant", () => {
  it("is opt-in and skips the presence animation only when set", () => {
    expect(SRC).toContain("instant = false,");
    expect(SRC).toContain("const mounted = instant ? open : presence.mounted;");
    expect(SRC).toContain("const shown = instant ? open : presence.shown;");
    expect(SRC).toContain('instant && "transition-none"');
    expect(SRC).toMatch(
      /!instant &&\s*"transition-\[opacity,transform\] duration-300/,
    );
  });
});
