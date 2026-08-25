import { describe, expect, it } from "vitest";

import { discoveryParamChrome } from "./param-tone";

describe("Discovery param chrome", () => {
  it("paints exponent in ink and the other knobs mute", () => {
    const superP = discoveryParamChrome("super");
    const normal = discoveryParamChrome("normal");
    expect(superP.label).toContain("text-foreground");
    expect(superP.label).toContain("font-semibold");
    expect(superP.input).toContain("border-foreground");
    expect(normal.label).toContain("text-muted-foreground");
    expect(normal.label).not.toContain("font-semibold");
    expect(normal.input).toContain("border-border");
  });
});
