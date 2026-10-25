// No DB rows from load, render, scroll, prefetch or select (MESITA-2298 §4,
// MESITA-2302 §9). The two discovery EFs and the engine read; the only row
// a load may mint is the per-IP Nearby ledger, behind
// `consumeNearbyGoogleQuota`, which meters a billed Google call.
import { assertEquals } from "jsr:@std/assert@1";

const FILES = [
  "../consumer-web-list-places/index.ts",
  "../consumer-web-list-catalog/index.ts",
  "./area-pipeline.ts",
  "./area-score.ts",
  "./pipeline-signals.ts",
  "./deep-pipeline.ts",
  "../consumer-web-ask-memo/index.ts",
];

for (const file of FILES) {
  Deno.test(`read-only: ${file} writes no rows`, async () => {
    const src = await Deno.readTextFile(new URL(file, import.meta.url));
    for (const write of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc("]) {
      assertEquals(src.includes(write), false, `${file} calls ${write}`);
    }
    for (const create of ["createPlace", "getOrCreate", "consumer-web-create-place"]) {
      assertEquals(src.includes(create), false, `${file} names ${create}`);
    }
  });
}
