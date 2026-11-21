// MESITA-4517: a feed is its lanes' batches, woven; Family both is the
// places strong on close AND well known, never an average.
import { assertEquals } from "jsr:@std/assert@1";
import { strongOnBoth, weaveLanes } from "./pipeline-signals.ts";

Deno.test("strongOnBoth: better half of each ranking, ordered by the worse rank", () => {
  const close = ["a", "b", "c", "d", "e", "f"];
  const well = ["c", "f", "a", "b", "e", "d"];
  // Better half (index < 3): close {a,b,c}, well {c,f,a}. Both: a (0,2) and c (2,0).
  // Worse ranks tie at 2 and better ranks at 0: the close rank decides.
  assertEquals(strongOnBoth(close, well), ["a", "c"]);
  // Merely close (b) and merely famous (f) stay off.
  assertEquals(strongOnBoth(close, well).includes("b") || strongOnBoth(close, well).includes("f"), false);
});

Deno.test("weaveLanes: each lane gives its batch per weave, one place once, ads by cadence and capped per weave", () => {
  const both = { key: "both", ids: ["a", "c"], batch: 2 };
  const close = { key: "close", ids: ["a", "b", "c", "d", "e", "f"], batch: 2 };
  const well = { key: "well", ids: ["c", "f", "a", "b", "e", "d"], batch: 2 };
  const out = weaveLanes([both, close, well], { key: "ad", ids: ["p", "q", "r"], batch: 1 }, 2);
  // Weave 1: both a,c · close b,d · well f,e → interleaved a,b,f,c,d,e; one ad after 2 organic, at most 1.
  assertEquals(out.order.slice(0, 7), ["a", "b", "p", "f", "c", "d", "e"]);
  assertEquals(out.weaves[0], 7);
  assertEquals(new Set(out.order).size, out.order.length);
  assertEquals(out.laneOf.c, "both");
  assertEquals(out.laneOf.b, "close");
  assertEquals(out.laneOf.f, "well");
  assertEquals(out.laneOf.p, "ad");
  assertEquals(out.adIds[0], "p");
  // Every organic place is in the feed.
  for (const id of close.ids) assertEquals(out.order.includes(id), true, id);
  // adEvery 0: no ads.
  assertEquals(weaveLanes([close], { key: "ad", ids: ["p"], batch: 5 }, 0).adIds, []);
});
