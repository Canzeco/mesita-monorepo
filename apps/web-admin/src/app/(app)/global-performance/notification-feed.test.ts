import { describe, expect, it } from "vitest";
import type { NotificationItem, NotificationType } from "./actions";
import {
  groupConsecutiveSteps,
  intakeFactChips,
  intakeFunctionChips,
  intakeStatusLine,
  itemMatchesIntakeFilter,
  pinReports,
  showCategoryOnCompact,
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

describe("intakeStatusLine", () => {
  const facts = {
    seeded: true,
    active: true,
    listed: true,
    requested: false,
    enriching: false,
    enriched: false,
    enrichPulse: 2,
    enrichPulseTotal: 10,
    verified: false,
    partner: false,
    promoting: false,
    mesita_pay: false,
    yums: false,
  };

  it("prints every true general fact and never a high-water n/10", () => {
    const created = item({
      id: "c",
      type: "atlas.place_created",
      meta: { statusFacts: facts, listingType: "unclaimed", claimed: false },
    });
    expect(intakeStatusLine(created)).toBe("Created · Active · Listed");
    expect(intakeStatusLine(created)).not.toMatch(/\d+\/\d+/);
    expect(intakeStatusLine(created)).not.toMatch(/claim/i);
    expect(intakeStatusLine(created)).not.toMatch(/new place/i);
  });

  it("names Enriched · Verified · Partnered · Promoted when those facts are on", () => {
    const created = item({
      id: "c",
      type: "atlas.place_created",
      meta: {
        statusFacts: {
          ...facts,
          enriched: true,
          enrichPulse: 10,
          verified: true,
          partner: true,
          promoting: true,
        },
      },
    });
    expect(intakeStatusLine(created)).toBe(
      "Created · Active · Listed · Enriched · Verified · Partnered · Promoted",
    );
  });

  it("names Requested after Listed, then Enriched before Enriching", () => {
    const created = item({
      id: "c",
      type: "atlas.place_created",
      meta: {
        statusFacts: {
          ...facts,
          requested: true,
          enriching: true,
          enriched: true,
        },
      },
    });
    expect(intakeStatusLine(created)).toBe(
      "Created · Active · Listed · Requested · Enriched · Enriching",
    );
  });

  it("names the acceptance bits when true, and keeps their chips filtered out", () => {
    const created = item({
      id: "c",
      type: "atlas.place_created",
      meta: {
        statusFacts: { ...facts, mesita_pay: true, yums: true },
      },
    });
    expect(intakeStatusLine(created)).toBe(
      "Created · Active · Listed · Mesita Pay · Accepts Yums",
    );
    // Engineless facts never render meta chips until a stamper exists
    // (the gateway / Credits PRs lift the intakeFactChips filter).
    const chipKeys = intakeFactChips(created).map((c) => c.key);
    expect(chipKeys).not.toContain("mesita_pay");
    expect(chipKeys).not.toContain("yums");
    expect(chipKeys).toContain("partner");
  });

  it("falls back for create events that predate statusFacts", () => {
    const created = item({
      id: "c",
      type: "atlas.place_created",
      meta: { status: "paused" },
    });
    expect(intakeStatusLine(created)).toBe("Created · Unlisted");
  });
});

describe("itemMatchesIntakeFilter", () => {
  const facts = {
    seeded: true,
    active: true,
    listed: true,
    enriched: false,
    enrichPulse: 2,
    enrichPulseTotal: 10,
    verified: false,
    partner: false,
    promoting: false,
    functions: {
      pulse: true,
      details: true,
      name: true,
    },
  };

  it("matches general Created and Intake Pulse, not Serp", () => {
    const created = item({
      id: "c",
      type: "atlas.place_created",
      meta: { statusFacts: facts },
    });
    expect(itemMatchesIntakeFilter(created, "seeded")).toBe(true);
    expect(itemMatchesIntakeFilter(created, "fn:seed")).toBe(true);
    expect(itemMatchesIntakeFilter(created, "fn:pulse")).toBe(true);
    expect(itemMatchesIntakeFilter(created, "fn:serp")).toBe(false);
    expect(itemMatchesIntakeFilter(created, "fn:embedding")).toBe(false);
  });
});

describe("intakeFunctionChips", () => {
  const chipsWith = (functions: Record<string, boolean>) =>
    intakeFunctionChips(
      item({
        id: "c",
        type: "atlas.place_created",
        meta: {
          statusFacts: {
            seeded: true,
            active: false,
            listed: false,
            enriched: false,
            enrichPulse: 0,
            enrichPulseTotal: 10,
            verified: false,
            partner: false,
            promoting: false,
            functions,
          },
        },
      }),
    );

  it("lists eleven functions 0–10 and turns Embedding on from its stamp", () => {
    const chips = chipsWith({ embedding: true });
    expect(chips).toHaveLength(11);
    expect(chips[0]).toMatchObject({ key: "seed", label: "0. Seed", on: true });
    expect(chips.find((c) => c.key === "embedding")).toMatchObject({
      label: "10. Embedding",
      on: true,
    });
    expect(chips.find((c) => c.key === "serp")).toMatchObject({
      label: "3. Serp",
      on: false,
    });
  });

  it("folds legacy `semantic` and `name`+`summary` stamps into Embedding", () => {
    const legacy = chipsWith({ semantic: true });
    expect(legacy.find((c) => c.key === "embedding")).toMatchObject({
      label: "10. Embedding",
      on: true,
    });
    const preMerge = chipsWith({ name: true, summary: true });
    expect(preMerge.find((c) => c.key === "embedding")?.on).toBe(true);
    const nameOnly = chipsWith({ name: true });
    expect(nameOnly.find((c) => c.key === "embedding")?.on).toBe(false);
  });
});

describe("showCategoryOnCompact", () => {
  it("hides category on Intake rows so it cannot pass as a status", () => {
    expect(
      showCategoryOnCompact(item({ id: "c", type: "atlas.place_created" })),
    ).toBe(false);
    expect(
      showCategoryOnCompact(item({ id: "s", type: "consumer.place_saved" })),
    ).toBe(true);
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
