import assert from "node:assert/strict";
import test from "node:test";
import { writePlaceUrl } from "./write-place.ts";

test("the write URL is the one enrichment function", () => {
  assert.equal(
    writePlaceUrl("https://yjalywfzdelacdzccpgb.supabase.co/"),
    "https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/enricher-edgefunc-write-place",
  );
});
