import { describe, expect, it } from "vitest";

import {
  intakeFansOutCreates,
  intakeShouldEnqueueEnrich,
} from "./intake-batch";

describe("intakeFansOutCreates", () => {
  it("fans out Create and Create+Enrich; Enrich only enqueues", () => {
    expect(intakeFansOutCreates("create")).toBe(true);
    expect(intakeFansOutCreates("create_enrich")).toBe(true);
    expect(intakeFansOutCreates("enrich")).toBe(false);
  });
});

describe("intakeShouldEnqueueEnrich", () => {
  it("never adds a second enrich kick on Create-only", () => {
    expect(
      intakeShouldEnqueueEnrich({
        action: "create",
        enrichmentTriggered: false,
      }),
    ).toBe(false);
    expect(
      intakeShouldEnqueueEnrich({
        action: "create",
        enrichmentTriggered: true,
      }),
    ).toBe(false);
  });

  it("always enqueues on Enrich-only", () => {
    expect(
      intakeShouldEnqueueEnrich({
        action: "enrich",
        enrichmentTriggered: false,
      }),
    ).toBe(true);
  });

  it("enqueues after Create+Enrich only when create did not already queue", () => {
    expect(
      intakeShouldEnqueueEnrich({
        action: "create_enrich",
        enrichmentTriggered: true,
      }),
    ).toBe(false);
    expect(
      intakeShouldEnqueueEnrich({
        action: "create_enrich",
        enrichmentTriggered: false,
      }),
    ).toBe(true);
  });
});
