import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import {
  emulatedFollowerCount,
  emulatorLookup,
  readInstagramLookup,
} from "./instagram-lookup.ts";

// The emulator must stay an emulator: predictable, marked, and offline.

Deno.test("emulator: the same username always gets the same sample", async () => {
  const a = await emulatorLookup.lookup("mesita.mx");
  const b = await emulatorLookup.lookup("mesita.mx");
  assertEquals(a, b);
  assert(a.ok);
  assertEquals(a.profile.username, "mesita.mx");
  assertMatch(a.profile.profilePictureUrl, /^data:image\/svg\+xml,/);
  const n = a.profile.followerCount;
  assert(Number.isInteger(n) && n >= 100 && n < 25_000);
});

Deno.test("emulator: different usernames get different counts", () => {
  const counts = new Set(["a", "b", "c", "d", "e"].map(emulatedFollowerCount));
  assert(counts.size > 1);
});

Deno.test("emulator: an `unavailable…` username finds nothing", async () => {
  assertEquals(await emulatorLookup.lookup("unavailable_test"), {
    ok: false,
    reason: "not_found",
  });
});

Deno.test("emulator: never touches the network", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("the emulator must not fetch");
  };
  try {
    await emulatorLookup.lookup("someone");
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("the provider in use is marked emulator", () => {
  assertEquals(readInstagramLookup().source, "emulator");
});
