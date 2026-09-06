// The audience boundary and the photo cap, as tests rather than comments.
//
// These live here, in Deno, because that is where the code lives. An earlier
// draft of this work put the cap's test in apps/web-business (vitest) for
// logic that runs in an Edge Function — testing the wrong runtime.

import { assertEquals } from "jsr:@std/assert@1";
import {
  capPhotos,
  FORBIDDEN_COLUMNS,
  GET_PLACE_SELECT,
  MAX_PHOTOS,
  PLACE_COLUMNS,
  PROJECT_COLUMNS,
  totalPhotos,
} from "./place-projection.ts";

Deno.test("AUDIENCE: the projection lists no operator-only column", () => {
  const selected = new Set([...PROJECT_COLUMNS, ...PLACE_COLUMNS]);
  const leaked = FORBIDDEN_COLUMNS.filter((c) => selected.has(c));
  assertEquals(leaked, [], `business payload must not carry: ${leaked.join(", ")}`);
});

Deno.test("AUDIENCE: the rendered select string mentions no forbidden column", () => {
  // Substring, not set membership: this catches a column smuggled in by hand
  // editing GET_PLACE_SELECT rather than the arrays.
  const leaked = FORBIDDEN_COLUMNS.filter((c) =>
    new RegExp(`\\b${c}\\b`).test(GET_PLACE_SELECT)
  );
  assertEquals(leaked, []);
});

Deno.test("the select embeds places with an inner join", () => {
  assertEquals(GET_PLACE_SELECT.includes("places!inner("), true);
  assertEquals(GET_PLACE_SELECT.startsWith("id, state"), true);
});

Deno.test("capPhotos: 13 in, 10 out", () => {
  const thirteen = Array.from({ length: 13 }, (_, i) => `https://x/${i}.jpg`);
  assertEquals(capPhotos(thirteen).length, MAX_PHOTOS);
  assertEquals(capPhotos(thirteen)[0], "https://x/0.jpg");
  assertEquals(capPhotos(thirteen)[9], "https://x/9.jpg");
});

Deno.test("capPhotos: under the cap passes through in order", () => {
  const three = ["a", "b", "c"];
  assertEquals(capPhotos(three), ["a", "b", "c"]);
});

Deno.test("capPhotos: the empty array is the real majority case", () => {
  // places.photos is `not null default '{}'`, so [] is what a photoless row
  // actually carries. null is unreachable from the DB but cheap to survive.
  assertEquals(capPhotos([]), []);
  assertEquals(capPhotos(null), []);
  assertEquals(capPhotos(undefined), []);
});

Deno.test("capPhotos: a bad element never reaches an <img src>", () => {
  assertEquals(capPhotos(["ok", null, "", "   ", 42, "also-ok"]), [
    "ok",
    "also-ok",
  ]);
  assertEquals(capPhotos("not-an-array"), []);
});

Deno.test("totalPhotos reports the truth, not the capped count", () => {
  const thirteen = Array.from({ length: 13 }, (_, i) => `p${i}`);
  assertEquals(totalPhotos(thirteen), 13);
  assertEquals(capPhotos(thirteen).length, 10);
  // "10 of 13 photos" is only honest if these two disagree.
  assertEquals(totalPhotos([]), 0);
  assertEquals(totalPhotos(["a", null, "b"]), 2);
});
