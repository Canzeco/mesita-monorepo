// The Google-only open ledger (MESITA-2323).
import { assertEquals } from "jsr:@std/assert@1";
import { recordPlaceOpen } from "./place-open-events.ts";

Deno.test("record: a ledger error never throws into the open", async () => {
  const calls: unknown[] = [];
  const admin = {
    from: (t: string) => ({
      insert: (row: unknown) => {
        calls.push([t, row]);
        return Promise.resolve({ error: { message: "boom" } });
      },
    }),
  };
  await recordPlaceOpen(admin as never, {
    googlePlaceId: "g",
    consumerId: "u",
    outcome: "existing",
    placeId: "p",
    caller: "consumer-web-create-place",
  });
  assertEquals(calls.length, 1);
  const thrower = { from: () => ({ insert: () => { throw new Error("down"); } }) };
  await recordPlaceOpen(thrower as never, {
    googlePlaceId: "g",
    consumerId: null,
    outcome: "failed",
    caller: "consumer-web-create-place",
  });
});

Deno.test("the create EF logs every exit: existing, refused (switch, quota), failed, created", async () => {
  const src = await Deno.readTextFile(
    new URL("../consumer-web-create-place/index.ts", import.meta.url),
  );
  for (const needle of [
    'outcome: "existing", placeId: placeIdOf(existing)',
    'outcome: "refused", code: "create_on_open_off"',
    'outcome: "refused", code: "quota"',
    'outcome: "failed"',
    'outcome: "created"',
    'code: "raced"',
  ]) {
    assertEquals(src.includes(needle), true, needle);
  }
});
