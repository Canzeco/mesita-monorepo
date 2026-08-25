import { describe, expect, it } from "vitest";

import { methodLabel } from "./verification-config";

describe("methodLabel", () => {
  it("names the live proof methods", () => {
    expect(methodLabel("ai_call")).toBe("AI phone call");
    expect(methodLabel("ai_email")).toBe("AI email");
    expect(methodLabel("manual_contact")).toBe("Manual contact");
  });

  it("title-cases unknown methods instead of crashing", () => {
    expect(methodLabel("walk_in")).toBe("Walk in");
    expect(methodLabel(null)).toBe("");
  });
});
