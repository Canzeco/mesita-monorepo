import { assert } from "jsr:@std/assert@1";
import { AttemptEntrySchema } from "./reservation-attempts.ts";

Deno.test("AttemptEntrySchema: accepts a valid entry, conversation_id null or set", () => {
  assert(AttemptEntrySchema.parse({ n: 1, started_at: "2026-08-23T00:00:00Z", conversation_id: null, result: "dialing" }).ok);
  assert(AttemptEntrySchema.parse({ n: 1, started_at: "2026-08-23T00:00:00Z", conversation_id: "conv_abc", result: "answered" }).ok);
});

Deno.test("AttemptEntrySchema: rejects an unknown key", () => {
  const r = AttemptEntrySchema.parse({ n: 1, started_at: "x", conversation_id: null, result: "dialing", extra: true });
  assert(!r.ok);
});

Deno.test("AttemptEntrySchema: rejects a wrong-typed n", () => {
  assert(!AttemptEntrySchema.parse({ n: "1", started_at: "x", conversation_id: null, result: "dialing" }).ok);
});
