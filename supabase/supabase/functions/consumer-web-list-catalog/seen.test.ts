import { assertEquals } from "jsr:@std/assert@1";
import { demoteSeen, readSeen } from "./seen.ts";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const c = "33333333-3333-4333-8333-333333333333";

Deno.test("seen ids sink to the end of the first page and the tail stays", () => {
  assertEquals(demoteSeen([a, b, c, "tail"], [a], 3), [b, c, a, "tail"]);
});

Deno.test("a page the guest has seen entirely stays put", () => {
  assertEquals(demoteSeen([a, b], [a, b], 2), [a, b]);
});

Deno.test("readSeen keeps uuids only, capped", () => {
  assertEquals(readSeen([a, "nope", a, b]), [a, b]);
  assertEquals(readSeen(undefined), []);
});
