import { assertEquals } from "jsr:@std/assert@1";
import { jsonError, jsonOk, methodNotAllowed, readJsonOr, rejectUnlessMethods } from "./http.ts";

Deno.test("methodNotAllowed returns 405 + canonical body", async () => {
  const res = methodNotAllowed();
  assertEquals(res.status, 405);
  assertEquals(await res.json(), { ok: false, error: "Method not allowed" });
});

Deno.test("rejectUnlessMethods allows listed verbs", () => {
  const req = new Request("https://x", { method: "GET" });
  assertEquals(rejectUnlessMethods(req, "GET", "POST"), null);
});

Deno.test("rejectUnlessMethods rejects others", async () => {
  const req = new Request("https://x", { method: "PUT" });
  const res = rejectUnlessMethods(req, "GET", "POST");
  assertEquals(res?.status, 405);
  assertEquals(await res!.json(), { ok: false, error: "Method not allowed" });
});

Deno.test("jsonOk wraps ok:true", async () => {
  const res = jsonOk({ email: "a@b.c" });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true, email: "a@b.c" });
});

Deno.test("jsonError wraps ok:false", async () => {
  const res = jsonError("nope", 403);
  assertEquals(res.status, 403);
  assertEquals(await res.json(), { ok: false, error: "nope" });
});


// ── readJsonOr: the three shapes a body can arrive in ────────────────────
//
// The middle case is the one that bit. `catch` only fires on a PARSE failure,
// and JSON.parse accepts the literal `null`, so a null body used to sail past
// the fallback into 51 call sites that immediately read a field off it. Each
// threw out of the Deno.serve handler: a bare 500, no CORS headers, no
// { ok:false } envelope (MESITA-1730). Consumer browse, business place reads
// and the eleven-* agent webhooks were all reachable that way.

function bodyReq(raw: string | null): Request {
  return new Request("https://ef.test/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(raw === null ? {} : { body: raw }),
  });
}

Deno.test("readJsonOr returns the parsed object when there is one", async () => {
  assertEquals(
    await readJsonOr<{ section?: string }>(bodyReq('{"section":"rewards"}'), {}),
    { section: "rewards" },
  );
});

Deno.test("readJsonOr falls back when the body is absent or unparseable", async () => {
  assertEquals(await readJsonOr<{ a?: number }>(bodyReq(null), {}), {});
  assertEquals(await readJsonOr<{ a?: number }>(bodyReq("not json"), {}), {});
});

Deno.test("readJsonOr falls back on a literal null body, and callers can dereference", async () => {
  const body = await readJsonOr<{ section?: unknown }>(bodyReq("null"), {});
  assertEquals(body, {});
  // The assertion that matters: this is what every call site does next, and
  // it must not throw.
  assertEquals(typeof body.section === "string" ? body.section : "", "");
});

Deno.test("readJsonOr falls back on a JSON literal that is not an object", async () => {
  // Scalars and arrays parse fine and are not null, so they come back as-is.
  // Reading a field off them yields undefined rather than throwing, which is
  // why these never crashed and `null` did.
  assertEquals(await readJsonOr<Record<string, unknown>>(bodyReq("5"), {}), 5 as never);
  assertEquals(await readJsonOr<Record<string, unknown>>(bodyReq("[]"), {}), [] as never);
});
