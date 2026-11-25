// MESITA-4931: the app's contract check in serveJson. The web sends no header
// and must never be refused; a bad secret must refuse nobody.

import { assertEquals } from "jsr:@std/assert@1";
import { servedHandler } from "./http.ts";

type Seen = { res: Response; handled: boolean; logs: string[]; errors: string[] };

async function call(opts: {
  header?: string;
  min?: string;
  fn?: string;
  method?: string;
  headers?: Record<string, string>;
}): Promise<Seen> {
  const saved = Deno.env.get("MOBILE_MIN_CONTRACT");
  if (opts.min === undefined) Deno.env.delete("MOBILE_MIN_CONTRACT");
  else Deno.env.set("MOBILE_MIN_CONTRACT", opts.min);
  const logs: string[] = [];
  const errors: string[] = [];
  const { log, error } = console;
  console.log = (...a: unknown[]) => void logs.push(a.join(" "));
  console.error = (...a: unknown[]) => void errors.push(a.join(" "));
  let handled = false;
  try {
    const headers = new Headers(opts.headers);
    if (opts.header !== undefined) headers.set("x-mesita-contract", opts.header);
    const res = await servedHandler(opts.fn ?? "consumer-web-x", () => {
      handled = true;
      return new Response("served", { status: 201 });
    })(new Request("https://ef.test/x", { method: opts.method ?? "POST", headers }));
    return { res, handled, logs, errors };
  } finally {
    console.log = log;
    console.error = error;
    if (saved === undefined) Deno.env.delete("MOBILE_MIN_CONTRACT");
    else Deno.env.set("MOBILE_MIN_CONTRACT", saved);
  }
}

async function assertServed(s: Seen) {
  assertEquals(s.handled, true);
  assertEquals(s.res.status, 201);
  assertEquals(await s.res.text(), "served");
}

async function assertRefused(s: Seen, min: number, seen: number) {
  assertEquals(s.handled, false);
  assertEquals(s.res.status, 426);
  assertEquals(s.res.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(await s.res.json(), {
    ok: false,
    code: "update_app",
    error: "Update Mesita to continue.",
    min_contract: min,
    seen_contract: seen,
  });
}

Deno.test("a lower number is the 426 with both numbers", async () => {
  await assertRefused(await call({ header: "4", min: "5" }), 5, 4);
});

Deno.test("numbers compare as numbers, not as text", async () => {
  await assertServed(await call({ header: "10", min: "9" }));
});

Deno.test("an equal or higher number is served", async () => {
  await assertServed(await call({ header: "5", min: "5" }));
  await assertServed(await call({ header: "6", min: " 5 " }));
});

Deno.test("no header (the web) is served and logs nothing", async () => {
  for (const min of [undefined, "5", "five"]) {
    const s = await call({ min });
    await assertServed(s);
    assertEquals([s.logs, s.errors], [[], []]);
  }
});

Deno.test("a header that is not a whole number counts as 0", async () => {
  for (const header of ["abc", "", "4.5", "-1", "1e9", "5x"]) {
    await assertRefused(await call({ header, min: "1" }), 1, 0);
  }
});

Deno.test("an unset or empty minimum refuses nobody, silently", async () => {
  for (const min of [undefined, "", " "]) {
    const s = await call({ header: "0", min });
    await assertServed(s);
    assertEquals(s.errors, []);
  }
});

Deno.test("a malformed minimum refuses nobody and logs min_contract_malformed", async () => {
  for (const min of ["five", "5.5", "-3", "0x10"]) {
    const s = await call({ header: "0", min });
    await assertServed(s);
    assertEquals(s.errors, ['[consumer-web-x] {"code":"min_contract_malformed"}']);
  }
});

Deno.test("OPTIONS is never refused", async () => {
  const s = await call({ header: "0", min: "5", method: "OPTIONS" });
  await assertServed(s);
  assertEquals(s.logs, []);
});

Deno.test("a function of another actor is never checked", async () => {
  for (const fn of ["business-web-x", "admin-web-x", "visit-web-x", "eleven-agent-x", "supabase-cron-x", "consumer-edgefunc-x"]) {
    const s = await call({ fn, header: "0", min: "5" });
    await assertServed(s);
    assertEquals(s.logs, []);
  }
});

Deno.test("the log line carries the number and Supabase's request id, and no second id is sent", async () => {
  const s = await call({ header: "7", headers: { "sb-request-id": "01-abc" } });
  await assertServed(s);
  assertEquals(s.logs, ['[consumer-web-x] {"contract":7,"request_id":"01-abc"}']);
  assertEquals([...s.res.headers.keys()].filter((k) => k.includes("request-id")), []);
});

Deno.test("a throw behind the check is still the JSON 500", async () => {
  const { error } = console;
  console.error = () => {};
  try {
    const res = await servedHandler("consumer-web-x", () => {
      throw new Error("boom");
    })(new Request("https://ef.test/x", { method: "POST" }));
    assertEquals(res.status, 500);
  } finally {
    console.error = error;
  }
});
