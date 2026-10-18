// The Google-only open ledger (MESITA-2323).
import { assertEquals } from "jsr:@std/assert@1";
import { recordPlaceOpen, summarizePlaceOpens } from "./place-open-events.ts";

Deno.test("summary: outcomes, distinct places, profile rate, repeated places first", () => {
  const s = summarizePlaceOpens([
    { google_place_id: "a", outcome: "created", place_id: "p-a" },
    { google_place_id: "a", outcome: "existing", place_id: "p-a" },
    { google_place_id: "a", outcome: "existing", place_id: "p-a" },
    { google_place_id: "b", outcome: "refused", place_id: null },
    { google_place_id: "b", outcome: "created", place_id: "p-b" },
    { google_place_id: "c", outcome: "failed", place_id: null },
  ]);
  assertEquals(s.opens, 6);
  assertEquals(s.byOutcome, { existing: 2, created: 2, refused: 1, failed: 1 });
  assertEquals(s.places, 3);
  assertEquals(s.profileRate, 4 / 6);
  assertEquals(s.repeated, [
    { googlePlaceId: "a", opens: 3, created: true, placeId: "p-a" },
    { googlePlaceId: "b", opens: 2, created: true, placeId: "p-b" },
  ]);
});

Deno.test("summary: no rows is all zeros, not NaN", () => {
  const s = summarizePlaceOpens([]);
  assertEquals(s.opens, 0);
  assertEquals(s.profileRate, 0);
  assertEquals(s.repeated, []);
});

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
