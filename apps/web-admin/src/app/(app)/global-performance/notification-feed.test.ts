import { describe, expect, it } from "vitest";
import type { NotificationItem, NotificationType } from "./actions";
import {
  groupConsecutiveSteps,
  pinReports,
  typesForFetch,
  typesInDomain,
} from "./notification-feed";

function item(
  partial: Pick<NotificationItem, "id" | "type"> &
    Partial<NotificationItem>,
): NotificationItem {
  return {
    category: (partial.type.split(".")[0] ?? "atlas") as NotificationItem["category"],
    occurredAt: "2026-08-24T00:00:00.000Z",
    place: {
      id: "place-1",
      slug: "strana",
      name: "Strana",
      address: "1 Main",
      categoryLabel: "Nightclub",
      googlePlaceId: null,
    },
    actor: null,
    detail: null,
    meta: {},
    ...partial,
  };
}

describe("typesInDomain", () => {
  it("keeps only atlas types for Intake", () => {
    const types: NotificationType[] = [
      "atlas.place_created",
      "consumer.place_saved",
      "rewards.ticket_reported",
    ];
    expect(typesInDomain("atlas", types)).toEqual(["atlas.place_created"]);
  });
});

describe("typesForFetch", () => {
  it("omits Intaker steps on All unless asked", () => {
    const without = typesForFetch("all", false);
    expect(without).toBeDefined();
    expect(without).not.toContain("atlas.enrichment_step");
    expect(typesForFetch("all", true)).toBeUndefined();
  });

  it("omits steps on Intake unless asked", () => {
    const without = typesForFetch("atlas", false);
    expect(without).toBeDefined();
    expect(without?.every((t) => t.startsWith("atlas."))).toBe(true);
    expect(without).not.toContain("atlas.enrichment_step");
    expect(typesForFetch("atlas", true)).toBeUndefined();
  });
});

describe("pinReports", () => {
  it("lifts reports out of the chronological list", () => {
    const a = item({ id: "a", type: "atlas.place_created" });
    const r = item({ id: "r", type: "rewards.ticket_reported" });
    const b = item({ id: "b", type: "atlas.place_enriched" });
    expect(pinReports([a, r, b])).toEqual({
      reports: [r],
      rest: [a, b],
    });
  });
});

describe("groupConsecutiveSteps", () => {
  it("collapses consecutive steps for the same place", () => {
    const s1 = item({ id: "s1", type: "atlas.enrichment_step" });
    const s2 = item({ id: "s2", type: "atlas.enrichment_step" });
    const created = item({ id: "c", type: "atlas.place_created" });
    expect(groupConsecutiveSteps([s1, s2, created])).toEqual([
      { kind: "steps", items: [s1, s2] },
      { kind: "single", item: created },
    ]);
  });

  it("does not collapse a lone step", () => {
    const s1 = item({ id: "s1", type: "atlas.enrichment_step" });
    expect(groupConsecutiveSteps([s1])).toEqual([{ kind: "single", item: s1 }]);
  });

  it("splits steps when the place changes", () => {
    const a = item({
      id: "a",
      type: "atlas.enrichment_step",
      place: {
        id: "p-a",
        slug: "a",
        name: "A",
        address: null,
        categoryLabel: null,
        googlePlaceId: null,
      },
    });
    const b = item({
      id: "b",
      type: "atlas.enrichment_step",
      place: {
        id: "p-b",
        slug: "b",
        name: "B",
        address: null,
        categoryLabel: null,
        googlePlaceId: null,
      },
    });
    expect(groupConsecutiveSteps([a, b])).toEqual([
      { kind: "single", item: a },
      { kind: "single", item: b },
    ]);
  });
});
