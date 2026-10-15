import assert from "node:assert/strict";
import test from "node:test";
import { stopEnrichingBody, writePlaceUrl } from "./write-place.ts";

test("the write URL is the one enrichment function", () => {
  assert.equal(
    writePlaceUrl("https://yjalywfzdelacdzccpgb.supabase.co/"),
    "https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/enricher-edgefunc-write-place",
  );
});

test("a failed run asks the same function to turn enriching off", () => {
  assert.deepEqual(stopEnrichingBody("place-1"), { placeId: "place-1", stop: true });
});
