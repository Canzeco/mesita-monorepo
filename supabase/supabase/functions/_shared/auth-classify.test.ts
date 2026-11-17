// classifyCaller (MESITA-4246): who an anonymous-open read is talking to.
// No session or the project key is anonymous; a broken session is a 401,
// never quietly served the anonymous view. No network: fetch is stubbed.

import { assertEquals } from "jsr:@std/assert@1";
import { classifyCaller, isAnonymousBearer, jwtRole } from "./auth.ts";

const ENV = { url: "https://stub.supabase.co", anonKey: "anon-key" };

function jwt(payload: Record<string, unknown>): string {
  const b = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b({ alg: "HS256" })}.${b(payload)}.sig`;
}

function req(headers: Record<string, string>): Request {
  return new Request("https://stub/fn", { method: "POST", headers });
}

async function withAuth<T>(status: number, body: unknown, run: () => Promise<T>): Promise<T> {
  const real = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(body), { status }));
  try {
    return await run();
  } finally {
    globalThis.fetch = real;
  }
}

Deno.test("no bearer, the project key, or an anon-role JWT is anonymous", () => {
  assertEquals(isAnonymousBearer(null, req({}), "anon-key"), true);
  assertEquals(isAnonymousBearer("anon-key", req({}), "anon-key"), true);
  assertEquals(isAnonymousBearer("pk", req({ apikey: "pk" }), "anon-key"), true);
  assertEquals(jwtRole(jwt({ role: "anon" })), "anon");
  assertEquals(isAnonymousBearer(jwt({ role: "anon" }), req({}), "anon-key"), true);
  assertEquals(isAnonymousBearer(jwt({ role: "authenticated" }), req({}), "anon-key"), false);
  assertEquals(jwtRole("not-a-jwt"), null);
});

Deno.test("a broken session is a 401 session_invalid, never anonymous", async () => {
  const token = jwt({ role: "authenticated" });
  const res = await withAuth(401, { msg: "expired" }, () =>
    classifyCaller(req({ Authorization: `Bearer ${token}` }), ENV));
  assertEquals(res.ok, false);
  if (!res.ok) {
    assertEquals(res.response.status, 401);
    assertEquals((await res.response.json()).code, "session_invalid");
  }
});

Deno.test("a valid session is the member; no session never calls auth", async () => {
  const token = jwt({ role: "authenticated" });
  const user = { id: "u1", aud: "authenticated", role: "authenticated", email: "", phone: "+52", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  const res = await withAuth(200, user, () => classifyCaller(req({ Authorization: `Bearer ${token}` }), ENV));
  assertEquals(res.ok && res.user?.id, "u1");
  const none = await withAuth(500, {}, () => classifyCaller(req({}), ENV));
  assertEquals(none.ok && none.user, null);
});
