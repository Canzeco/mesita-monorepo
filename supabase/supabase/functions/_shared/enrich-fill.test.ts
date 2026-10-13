import { assertEquals } from "jsr:@std/assert";
import {
  descriptionRuns,
  embeddingRuns,
  type EnrichFill,
  channelForSocial,
  completedSnapshot,
  omitUnrunKeys,
  parseOverwrite,
  stepRuns,
} from "./enrich-fill.ts";

function fill(over: Partial<EnrichFill> = {}): EnrichFill {
  return {
    fill: true,
    overwrite: new Set(),
    completed: new Set(),
    earlier: new Set(),
    subprocesses: null,
    ...over,
  };
}

Deno.test("parseOverwrite rejects an unknown step", () => {
  assertEquals(parseOverwrite(["serp", "nope"]), { error: "Unknown overwrite step 'nope'." });
  assertEquals(parseOverwrite(["serp", "serp"]), ["serp"]);
  assertEquals(parseOverwrite(undefined), []);
});

Deno.test("fill runs a step only when it has not completed", () => {
  const plan = fill({ completed: new Set(["details", "serp"]) });
  assertEquals(stepRuns(plan, "details"), false);
  assertEquals(stepRuns(plan, "links"), true);
});

Deno.test("overwrite redoes a completed step and leaves the rest", () => {
  const plan = fill({
    completed: new Set(["details", "serp", "links"]),
    overwrite: new Set(["serp"]),
  });
  assertEquals(stepRuns(plan, "details"), false);
  assertEquals(stepRuns(plan, "serp"), true);
  assertEquals(stepRuns(plan, "links"), false);
});

Deno.test("an explicit trigger buy redoes its step even when completed", () => {
  const plan = fill({
    completed: new Set(["details"]),
    subprocesses: ["google"],
  });
  assertEquals(stepRuns(plan, "details"), true);
  assertEquals(stepRuns(plan, "serp"), false);
});

Deno.test("description and embedding recompute when an earlier step ran", () => {
  const plan = fill({
    completed: new Set(["description", "embedding", "serp"]),
    earlier: new Set(["serp"]),
  });
  assertEquals(descriptionRuns(plan), true);
  assertEquals(embeddingRuns(plan, true), true);
  const quiet = fill({
    completed: new Set(["description", "embedding"]),
  });
  assertEquals(descriptionRuns(quiet), false);
  assertEquals(embeddingRuns(quiet, false), false);
});

Deno.test("a legacy run without fill still runs every bought step", () => {
  const plan = fill({ fill: false, completed: new Set(["serp"]) });
  assertEquals(stepRuns(plan, "serp"), true);
  assertEquals(descriptionRuns(plan), true);
});

Deno.test("omitUnrunKeys drops fields the skipped steps own", () => {
  const place: Record<string, unknown> = {
    address: "a",
    website_url: "https://x",
    google_reviews: [],
    description: "about",
    photos: ["p"],
  };
  omitUnrunKeys(place, new Set(["links"]));
  assertEquals(place.address, undefined);
  assertEquals(place.website_url, "https://x");
  assertEquals(place.google_reviews, undefined);
  assertEquals(place.description, undefined);
  assertEquals(place.photos, undefined);
});

Deno.test("omitUnrunKeys drops Google spine extras a skipped Details left behind", () => {
  const place: Record<string, unknown> = {
    pitch: "editorial",
    story: null,
    x_url: null,
    threads_url: "https://threads",
    reddit_url: null,
    resy_url: null,
    didi_food_url: null,
    address: "kept-only-if-details",
  };
  omitUnrunKeys(place, new Set(["serp"]));
  assertEquals(place.pitch, undefined);
  assertEquals(place.story, undefined);
  assertEquals(place.x_url, undefined);
  assertEquals(place.threads_url, undefined);
  assertEquals(place.reddit_url, undefined);
  assertEquals(place.resy_url, undefined);
  assertEquals(place.didi_food_url, undefined);
  assertEquals(place.address, undefined);
});

Deno.test("a completed snapshot is frozen, and a missing one is not", () => {
  assertEquals(completedSnapshot(undefined), null);
  assertEquals([...(completedSnapshot([]) ?? [])], []);
  assertEquals([...(completedSnapshot(["details", "nope"]) ?? [])], ["details"]);
});

Deno.test("a skipped Links step keeps the stored handle over Google's", () => {
  assertEquals(
    channelForSocial(false, null, "https://ig.stored", "https://ig.prior"),
    "https://ig.stored",
  );
  assertEquals(
    channelForSocial(false, "https://ig.google", null, "https://ig.prior"),
    "https://ig.prior",
  );
  assertEquals(
    channelForSocial(true, "https://ig.google", "https://ig.stored", null),
    "https://ig.google",
  );
  assertEquals(channelForSocial(false, "  ", "", null), null);
});

Deno.test("gather does not strip description's facts before the write stage", async () => {
  const src = await Deno.readTextFile(
    new URL("../enricher-cron-enrich-place-first/index.ts", import.meta.url),
  );
  assertEquals(src.includes("omitUnrunKeys("), false);
});
