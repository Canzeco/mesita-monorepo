import { describe, expect, it } from "vitest";
import type { NotificationItem, NotificationType } from "./actions";
import {
  groupConsecutiveSteps,
  crenupFactChips,
  crenupStepChips,
  crenupStateLine,
  itemMatchesCrenupFilter,
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
  it("keeps only atlas types for Crenup", () => {
    const types: NotificationType[] = [
      "atlas.place_created",
      "consumer.place_saved",
      "rewards.ticket_reported",
    ];
    expect(typesInDomain("atlas", types)).toEqual(["atlas.place_created"]);
  });
});

describe("typesForFetch", () => {
  it("omits Enricher steps on All unless asked", () => {
    const without = typesForFetch("all", false);
    expect(without).toBeDefined();
    expect(without).not.toContain("atlas.enrichment_step");
    expect(typesForFetch("all", true)).toBeUndefined();
  });

  it("omits steps on Crenup unless asked", () => {
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

describe("crenupStateLine", () => {
  const facts = {
    seeded: true,
    active: true,
    listed: true,
    requested: false,
    enriching: false,
    enriched: false,
    enrichCrenup: 2,
    enrichCrenupTotal: 10,
    verified: false,
    partner: false,
    promoting: false,
    mesita_pay: false,
    credits: false,
  };

  it("prints every true general fact and never a high-water n/10", () => {
    const created = item({
      id: "c",
      type: "atlas.place_created",
      meta: { stateFacts: facts, listingType: "unclaimed", claimed: false },
    });
    expect(crenupStateLine(created)).toBe("Created · Active · Listed");
    expect(crenupStateLine(created)).not.toMatch(/\d+\/\d+/);
    expect(crenupStateLine(created)).not.toMatch(/claim/i);
    expect(crenupStateLine(created)).not.toMatch(/new place/i);
  });

  it("names Enriched · Verified · Partnered · Rewards when those facts are on", () => {
    const created = item({
      id: "c",
      type: "atlas.place_created",
      meta: {
        stateFacts: {
          ...facts,
          enriched: true,
          enrichCrenup: 10,
          verified: true,
          partner: true,
          promoting: true,
        },
      },
    });
    expect(crenupStateLine(created)).toBe(
      "Created · Active · Listed · Enriched · Verified · Partnered · Rewards",
    );
  });

  it("names Requested after Listed, then Enriching before Enriched", () => {
    const created = item({
      id: "c",
      type: "atlas.place_created",
      meta: {
        stateFacts: {
          ...facts,
          requested: true,
          enriching: true,
          enriched: true,
        },
      },
    });
    expect(crenupStateLine(created)).toBe(
      "Created · Active · Listed · Requested · Enriching · Enriched",
    );
  });

  it("names the acceptance bits when true, and keeps their chips filtered out", () => {
    const created = item({
      id: "c",
      type: "atlas.place_created",
      meta: {
        stateFacts: { ...facts, mesita_pay: true, credits: true },
      },
    });
    expect(crenupStateLine(created)).toBe(
      "Created · Active · Listed · Mesita Pay · Mesita Credits",
    );
    // Engineless facts never render meta chips until a stamper exists
    // (the gateway / Credits PRs lift the crenupFactChips filter).
    const chipKeys = crenupFactChips(created).map((c) => c.key);
    expect(chipKeys).not.toContain("mesita_pay");
    expect(chipKeys).not.toContain("credits");
    expect(chipKeys).toContain("partner");
  });

  it("falls back for create events that predate stateFacts", () => {
    const created = item({
      id: "c",
      type: "atlas.place_created",
      meta: { state: "paused" },
    });
    expect(crenupStateLine(created)).toBe("Created · Unlisted");
  });
});

describe("itemMatchesCrenupFilter", () => {
  const facts = {
    seeded: true,
    active: true,
    listed: true,
    enriched: false,
    enrichCrenup: 2,
    enrichCrenupTotal: 10,
    verified: false,
    partner: false,
    promoting: false,
    functions: {
      details: true,
      name: true,
    },
  };

  it("matches general Created and Crenup Details, not Serp", () => {
    const created = item({
      id: "c",
      type: "atlas.place_created",
      meta: { stateFacts: facts },
    });
    expect(itemMatchesCrenupFilter(created, "seeded")).toBe(true);
    expect(itemMatchesCrenupFilter(created, "fn:seed")).toBe(true);
    // @ts-expect-error — `pulse` is a retired rung, never a CrenupFilter
    itemMatchesCrenupFilter(created, "fn:pulse");
    expect(itemMatchesCrenupFilter(created, "fn:details")).toBe(true);
    expect(itemMatchesCrenupFilter(created, "fn:serp")).toBe(false);
    expect(itemMatchesCrenupFilter(created, "fn:embedding")).toBe(false);
  });
});

describe("crenupStepChips", () => {
  const chipsWith = (functions: Record<string, boolean>) =>
    crenupStepChips(
      item({
        id: "c",
        type: "atlas.place_created",
        meta: {
          stateFacts: {
            seeded: true,
            active: false,
            listed: false,
            enriched: false,
            enrichCrenup: 0,
            enrichCrenupTotal: 10,
            verified: false,
            partner: false,
            promoting: false,
            functions,
          },
        },
      }),
    );

  it("lists nine steps 0–8 and turns Embedding on from its stamp", () => {
    const chips = chipsWith({ embedding: true });
    expect(chips).toHaveLength(9);
    expect(chips[0]).toMatchObject({ key: "seed", label: "0. Seed", on: true });
    expect(chips.find((c) => c.key === "embedding")).toMatchObject({
      label: "8. Embedding",
      on: true,
    });
    expect(chips.find((c) => c.key === "serp")).toMatchObject({
      label: "2. Serp",
      on: false,
    });
    // Pulse and Menu were steps until MESITA-2027 — liveness is a subprocess
    // of Details, the menu is operator input. Neither gets a chip, and the
    // chip key type no longer admits them (hence the cast: that IS the guard).
    const keys = chips.map((c) => c.key as string);
    expect(keys).not.toContain("pulse");
    expect(keys).not.toContain("menu");
  });

  it("folds legacy `semantic` and `name`+`summary` stamps into Embedding", () => {
    const legacy = chipsWith({ semantic: true });
    expect(legacy.find((c) => c.key === "embedding")).toMatchObject({
      label: "8. Embedding",
      on: true,
    });
    const preMerge = chipsWith({ name: true, summary: true });
    expect(preMerge.find((c) => c.key === "embedding")?.on).toBe(true);
    const nameOnly = chipsWith({ name: true });
    expect(nameOnly.find((c) => c.key === "embedding")?.on).toBe(false);
  });
});

describe("showCategoryOnCompact", () => {
  it("hides category on Crenup rows so it cannot pass as a state", () => {
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
