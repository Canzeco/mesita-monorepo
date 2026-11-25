// MESITA-4931: what the test guest is refused, and that nobody else is. No
// network: env is set per test and fetch answers from here.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { fromFileUrl, join } from "jsr:@std/path@1";
import { json, servedHandler } from "./http.ts";
import { consumerOrAnonymousRequest, requireConsumerRequest } from "./request.ts";
import { refuseOutsideTestPlace, TEST_GUEST_RULES, type TestGuestRule } from "./test-guest.ts";

const FUNCTIONS = fromFileUrl(new URL("..", import.meta.url));
const ENV = {
  SUPABASE_URL: "https://stub.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
};
const USER = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "",
  phone: "5215500000000",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const TEST_PLACE = "00000000-0000-4000-8000-00000000000a";
const REAL_PLACE = "00000000-0000-4000-8000-00000000000b";

type World = { testGuest?: boolean; suspended?: boolean; consumersFail?: boolean };

/** Runs a door under `fnName` the way serveJson does; returns the tables read. */
async function through(
  fnName: string,
  world: World,
  placeId?: string,
  door: typeof requireConsumerRequest | typeof consumerOrAnonymousRequest = requireConsumerRequest,
): Promise<{ status: number; body: Record<string, unknown>; reads: string[] }> {
  const saved = Object.fromEntries(Object.keys(ENV).map((k) => [k, Deno.env.get(k)]));
  for (const [k, v] of Object.entries(ENV)) Deno.env.set(k, v);
  const reads: string[] = [];
  const realFetch = globalThis.fetch;
  const realError = console.error;
  console.error = () => {};
  globalThis.fetch = (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const reply = (body: unknown, status = 200) =>
      Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
    if (url.pathname === "/auth/v1/user") return reply(USER);
    const table = url.pathname.replace("/rest/v1/", "");
    reads.push(table);
    if (table === "guest_suspensions") return reply(world.suspended ? [{ id: 1 }] : []);
    if (table === "consumers") {
      return world.consumersFail ? reply({ message: "down" }, 500) : reply([{ is_test_guest: world.testGuest === true }]);
    }
    if (table === "places") return reply([{ is_test_place: url.searchParams.get("id") === `eq.${TEST_PLACE}` }]);
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    // A user token's role claim is what classifyCaller reads.
    const jwt = `h.${btoa(JSON.stringify({ role: "authenticated", sub: USER.id }))}.s`;
    const res = await servedHandler(fnName, async (req) => {
      const ctx = await door(req);
      if (ctx instanceof Response) return ctx;
      const refused = placeId ? await refuseOutsideTestPlace(ctx, placeId) : null;
      return refused ?? json({ ok: true, testGuest: ctx.testGuest });
    })(new Request("https://ef.test/x", { method: "POST", headers: { Authorization: `Bearer ${jwt}` } }));
    return { status: res.status, body: await res.json(), reads: reads.sort() };
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
    for (const [k, v] of Object.entries(saved)) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
  }
}

const REFUSED_WORDS: Partial<Record<TestGuestRule, string>> = {
  buy: "This is a test account. It can't buy.",
  pay: "This is a test account. It can't pay.",
  credit: "This is a test account. It can't send or receive credit.",
  account: "This is a test account. It can't be deleted.",
};

for (const [rule, error] of Object.entries(REFUSED_WORDS)) {
  const fns = Object.keys(TEST_GUEST_RULES).filter((f) => TEST_GUEST_RULES[f] === rule);
  Deno.test(`${rule}: the test guest is refused by ${fns.length} function(s); anyone else is not`, async () => {
    assert(fns.length > 0);
    for (const fn of fns) {
      const test = await through(fn, { testGuest: true });
      assertEquals([test.status, test.body], [403, { ok: false, code: "test_guest", error }], fn);
      const real = await through(fn, {});
      assertEquals([real.status, real.body], [200, { ok: true, testGuest: false }], fn);
    }
  });
}

Deno.test("reserve: the test guest reserves at the test place only", async () => {
  const fns = Object.keys(TEST_GUEST_RULES).filter((f) => TEST_GUEST_RULES[f] === "reserve");
  assertEquals(fns, [
    "consumer-web-confirm-reservation",
    "consumer-web-create-reservation",
    "consumer-web-update-reservation",
  ]);
  for (const fn of fns) {
    assertEquals((await through(fn, { testGuest: true }, TEST_PLACE)).status, 200);
    const real = await through(fn, { testGuest: true }, REAL_PLACE);
    assertEquals([real.status, real.body.code], [403, "test_guest"]);
    const guest = await through(fn, {}, REAL_PLACE);
    assertEquals([guest.status, guest.reads.includes("places")], [200, false]);
    const src = Deno.readTextFileSync(join(FUNCTIONS, fn, "index.ts"));
    assert(src.includes("await refuseOutsideTestPlace(ctx, "), fn);
  }
});

Deno.test("uncounted: the handler knows the test guest and stops before it writes", async () => {
  for (const [fn, door] of [
    ["consumer-web-track-activity", consumerOrAnonymousRequest],
    ["consumer-web-track-place-share", requireConsumerRequest],
  ] as const) {
    assertEquals(TEST_GUEST_RULES[fn], "uncounted");
    assertEquals((await through(fn, { testGuest: true }, undefined, door)).body.testGuest, true);
    assertEquals((await through(fn, {}, undefined, door)).body.testGuest, false);
    const src = Deno.readTextFileSync(join(FUNCTIONS, fn, "index.ts"));
    const stop = src.search(/if \(testGuest[^)]*\) return json/);
    const write = src.search(/\.from\("place_(activity|shares)"\)\.upsert/);
    assert(stop > 0 && write > stop, fn);
  }
});

Deno.test("an open function reads no flag: what every other guest call costs is unchanged", async () => {
  const r = await through("consumer-web-get-wallet", { testGuest: true });
  assertEquals([r.status, r.body.testGuest, r.reads], [200, false, ["guest_suspensions"]]);
});

Deno.test("a failed flag read refuses nobody; a suspended guest keeps their own refusal", async () => {
  assertEquals((await through("consumer-web-buy-voucher", { consumersFail: true })).status, 200);
  const s = await through("consumer-web-buy-voucher", { testGuest: true, suspended: true });
  assertEquals(s.body.code, "suspended");
});

Deno.test("every consumer-web function has a rule, and every rule a function and a door that reads it", () => {
  const onDisk = [...Deno.readDirSync(FUNCTIONS)].map((e) => e.name).filter((n) => n.startsWith("consumer-web-")).sort();
  assertEquals(Object.keys(TEST_GUEST_RULES).sort(), onDisk);
  for (const [fn, rule] of Object.entries(TEST_GUEST_RULES)) {
    if (rule === "open") continue;
    const src = Deno.readTextFileSync(join(FUNCTIONS, fn, "index.ts"));
    assert(/await (requireConsumerRequest|consumerOrAnonymousRequest)\(req/.test(src), fn);
  }
});
