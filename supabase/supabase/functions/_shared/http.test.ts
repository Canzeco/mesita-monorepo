import { assertEquals } from "jsr:@std/assert@1";
import { methodNotAllowed, rejectUnlessMethods } from "./http.ts";

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
