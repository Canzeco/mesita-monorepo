// MESITA-4238 — the re-pick's pure decisions: what a request may ask, which
// places never reach the model, and what each model reply becomes.

import { assertEquals } from "jsr:@std/assert@1";
import {
  BATCH_MAX,
  buildRepickMessages,
  classifyReply,
  parseRepickRequest,
  preSkip,
  sanitizeError,
} from "./families-repick.ts";

const ID = "00000000-0000-4000-8000-000000004238";
const run = () => "run-x";

Deno.test("parseRepickRequest: defaults, bounds, and dry-run-only knobs", () => {
  const ok = parseRepickRequest({}, run);
  assertEquals(typeof ok === "object" && ok.batch === 5 && ok.arm === "repick" && !ok.dryRun, true);
  assertEquals(typeof parseRepickRequest({ batch: BATCH_MAX + 1 }, run), "string");
  assertEquals(typeof parseRepickRequest({ batch: 0 }, run), "string");
  assertEquals(typeof parseRepickRequest({ cursor: "nope" }, run), "string");
  assertEquals(typeof parseRepickRequest({ place_ids: ["nope"] }, run), "string");
  assertEquals(typeof parseRepickRequest({ arm: "enrich" }, run), "string"); // enrich arm writes nothing
  assertEquals(typeof parseRepickRequest({ model: "gpt-6-luna" }, run), "string"); // live run keeps the config model
  assertEquals(typeof parseRepickRequest({ dryRun: true, model: "made-up" }, run), "string");
  const dry = parseRepickRequest({ dryRun: true, arm: "enrich", place_ids: [ID, ID] }, run);
  assertEquals(typeof dry === "object" && dry.placeIds?.length, 1);
});

Deno.test("preSkip: owned and in-flight places never reach the model; a disabled category is skipped, not hidden", () => {
  const enabled = new Set(["mexican_restaurant"]);
  const place = { operatorOwned: false, generating: false, googleTypes: ["mexican_restaurant"], category: null };
  assertEquals(preSkip(place, enabled), null);
  assertEquals(preSkip({ ...place, operatorOwned: true }, enabled), "owned");
  assertEquals(preSkip({ ...place, generating: true }, enabled), "generating");
  assertEquals(preSkip({ ...place, googleTypes: ["beauty_salon"] }, enabled), "category_disabled");
});

Deno.test("classifyReply: a 429 is a rate-limited failure, never a batch error", () => {
  const out = classifyReply({ ok: false, status: 429, error: "slow down req_abcdef123" }, null, () => null);
  assertEquals(out, { outcome: "failed", reason: "rate_limited", error: "slow down [request]" });
});

Deno.test("classifyReply: nothing usable keeps the list; the same list is unchanged; a new list is written", () => {
  const pick = (raw: unknown) => Array.isArray(raw) && raw.includes("mexican") ? ["mexican"] : null;
  assertEquals(classifyReply({ ok: true, parsed: { families: [] } }, ["family"], pick), { outcome: "kept", reason: "no_usable_reply" });
  assertEquals(classifyReply({ ok: true, parsed: { families: ["zoo"] } }, ["family"], pick), { outcome: "kept", reason: "unknown_slug" });
  assertEquals(classifyReply({ ok: true, parsed: { families: ["mexican"] } }, ["mexican"], pick), { outcome: "kept", reason: "unchanged" });
  assertEquals(classifyReply({ ok: true, parsed: { families: ["mexican"] } }, ["family", "dinner"], pick), { after: ["mexican"] });
});

Deno.test("buildRepickMessages: the amenity warning rides on the re-pick arm only", () => {
  const place = { name: "Taco", googleTypes: ["mexican_restaurant"], category: null, texts: { description: "Family-friendly", pitch: "", story: "" } };
  const repick = buildRepickMessages(place, ["mexican — Mexican: x"], "repick");
  const enrich = buildRepickMessages(place, ["mexican — Mexican: x"], "enrich");
  assertEquals(repick.system.includes("not evidence for a family"), true);
  assertEquals(enrich.system.includes("not evidence for a family"), false);
});

Deno.test("sanitizeError: keys and request ids never reach the page, and it stays short", () => {
  assertEquals(sanitizeError("bad key sk-abcdefghijklmnop"), "bad key [key]");
  assertEquals(sanitizeError("x".repeat(500)).length, 200);
});
