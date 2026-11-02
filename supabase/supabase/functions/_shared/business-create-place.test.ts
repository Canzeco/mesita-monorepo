// business-web-create-place (MESITA-3112): an owner's "Add and claim" spends
// Google money only after the per-person quota, and a create never grants the
// place (created ≠ owned; the claim review does that).
import { assert } from "jsr:@std/assert@1";

const SRC = await Deno.readTextFile(new URL("../business-web-create-place/index.ts", import.meta.url));
const code = SRC.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

Deno.test("an existing place answers before the quota; the quota runs before the create", () => {
  const get = code.indexOf("findPlaceByGooglePlaceId(admin");
  const quota = code.indexOf("consumeConsumerCreateQuota(admin");
  const create = code.indexOf("createMinimalPlace({");
  assert(get > 0 && quota > 0 && create > 0, "all three calls are present");
  assert(get < quota, "an existing place opens without spending quota");
  assert(quota < create, "the quota is metered before any Google spend");
});

Deno.test("a create never writes place_managers", () => {
  assert(!code.includes("place_managers"), "created ≠ owned");
  assert(!code.includes("place_verification_approve"), "no auto-approval");
});
