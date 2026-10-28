// requireAdminRequest is the one opening every admin-web-* EF runs before it
// touches operator data (MESITA-2982). These pin each failure reply — status
// and body, byte for byte what the inline sequence returned — and the
// success shape.
//
// No network: env is set per test and global fetch is stubbed, so the
// session lookup (GET /auth/v1/user) and the super_admins read
// (GET /rest/v1/super_admins) answer from here.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { type AdminRequest, requireAdminRequest } from "./auth.ts";

const ENV = {
  SUPABASE_URL: "https://stub.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
};
const USER = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "Ops@Example.com",
  phone: "",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};

type Stub = { session?: "valid" | "anonymous" | "invalid"; superAdmin?: boolean };

async function withStubs<T>(
  stub: Stub,
  env: Record<string, string | undefined>,
  run: (calls: string[]) => Promise<T>,
): Promise<T> {
  const saved = Object.fromEntries(Object.keys(ENV).map((k) => [k, Deno.env.get(k)]));
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push(url.pathname);
    const reply = (body: unknown, status = 200) =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      );
    if (url.pathname === "/auth/v1/user") {
      if (stub.session === "anonymous") return reply({ ...USER, email: "", phone: "" });
      return stub.session === "valid"
        ? reply(USER)
        : reply({ code: 401, error_code: "bad_jwt", msg: "invalid JWT" }, 401);
    }
    if (url.pathname === "/rest/v1/super_admins") {
      assertEquals(url.searchParams.get("email"), "eq.ops@example.com");
      return reply(stub.superAdmin ? [{ email: "ops@example.com", user_id: USER.id }] : []);
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = realFetch;
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

function post(headers: Record<string, string> = { Authorization: "Bearer jwt" }, method = "POST") {
  return new Request("https://ef.test/admin-web-x", { method, headers });
}

async function expectReply(res: AdminRequest | Response, status: number, body: string | null) {
  assert(res instanceof Response, "expected a Response");
  assertEquals(res.status, status);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(await res.text(), body ?? "");
}

Deno.test("OPTIONS is the bare CORS preflight, before anything else", async () => {
  await withStubs({}, {}, async (calls) => {
    await expectReply(await requireAdminRequest(post({}, "OPTIONS"), "POST"), 200, null);
    assertEquals(calls, []);
  });
});

Deno.test("a wrong method is the canonical 405", async () => {
  await withStubs({}, ENV, async (calls) => {
    await expectReply(
      await requireAdminRequest(post(undefined, "GET"), "POST"),
      405,
      '{"ok":false,"error":"Method not allowed"}',
    );
    assertEquals(calls, []);
  });
});

for (const missing of Object.keys(ENV)) {
  Deno.test(`missing ${missing} is the 500 "Server misconfigured"`, async () => {
    await withStubs({}, { ...ENV, [missing]: undefined }, async (calls) => {
      await expectReply(
        await requireAdminRequest(post(), "POST"),
        500,
        '{"ok":false,"error":"Server misconfigured"}',
      );
      assertEquals(calls, []);
    });
  });
}

Deno.test("no bearer token is a 401 with no lookup", async () => {
  await withStubs({}, ENV, async (calls) => {
    await expectReply(
      await requireAdminRequest(post({}), "POST"),
      401,
      '{"ok":false,"error":"Missing bearer token"}',
    );
    assertEquals(calls, []);
  });
});

Deno.test("a rejected session is the 401 Invalid session", async () => {
  await withStubs({ session: "invalid" }, ENV, async (calls) => {
    await expectReply(
      await requireAdminRequest(post(), "POST"),
      401,
      '{"ok":false,"error":"Invalid session"}',
    );
    assertEquals(calls, ["/auth/v1/user"]);
  });
});

Deno.test("a session with no email and no phone is the 401, with no lookup", async () => {
  await withStubs({ session: "anonymous" }, ENV, async (calls) => {
    await expectReply(
      await requireAdminRequest(post(), "POST"),
      401,
      '{"ok":false,"error":"No identity on session"}',
    );
    assertEquals(calls, ["/auth/v1/user"]);
  });
});

Deno.test("a caller not in super_admins is the 403, default message", async () => {
  await withStubs({ session: "valid", superAdmin: false }, ENV, async (calls) => {
    await expectReply(
      await requireAdminRequest(post(), "POST"),
      403,
      '{"ok":false,"error":"Not a super-admin"}',
    );
    assertEquals(calls, ["/auth/v1/user", "/rest/v1/super_admins"]);
  });
});

Deno.test("a caller not in super_admins is the 403 with the EF's own message", async () => {
  await withStubs({ session: "valid", superAdmin: false }, ENV, async () => {
    await expectReply(
      await requireAdminRequest(post(), "POST", "Only admins can create places."),
      403,
      '{"ok":false,"error":"Only admins can create places."}',
    );
  });
});

Deno.test("a super-admin gets env, the service-role client and the user", async () => {
  await withStubs({ session: "valid", superAdmin: true }, ENV, async () => {
    const res = await requireAdminRequest(post(), "POST");
    assert(!(res instanceof Response), "expected the admin context");
    assertEquals(res.env, {
      url: ENV.SUPABASE_URL,
      anonKey: ENV.SUPABASE_ANON_KEY,
      serviceKey: ENV.SUPABASE_SERVICE_ROLE_KEY,
    });
    assertEquals(res.user.id, USER.id);
    assertEquals(res.user.emailLower, "ops@example.com");
    assertEquals(typeof res.admin.from, "function");
  });
});
