import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

// Skeleton defaults `rounded-lg`. `--radius-panel` is a named hero step, not
// a t-shirt size, so unextended twMerge left both classes on the pass block
// (MESITA-1336). Do not pin the pixel value — the token's existence is the
// invariant; its size lives in Design.
describe("cn rounded-panel vs rounded-lg (MESITA-1336)", () => {
  it("rounded-panel wins over rounded-lg", () => {
    expect(cn("rounded-lg", "rounded-panel")).toBe("rounded-panel");
  });

  it("--radius-panel exists in the consumer stylesheet", () => {
    const css = readFileSync(
      join(__dirname, "..", "..", "app", "globals.css"),
      "utf8",
    );
    expect(css).toMatch(/--radius-panel:/);
  });
});
