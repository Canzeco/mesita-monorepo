import { assertEquals } from "jsr:@std/assert@1";
import type { User } from "jsr:@supabase/supabase-js@2";
import { shapeAuthedUser } from "../_shared/auth.ts";
import { handleSignin, providersOf, type SigninDeps, type SigninRow, type SigninUser } from "./signin.ts";

// Every consumer sign-in method reaches the app through this EF (MESITA-3777):
// a phone code, Continue with Google or an email code. Before it, a session
// without a phone was a 400 and the guest stalled on /onboard.

const ROW: SigninRow = {
  id: "u1",
  code: "1234-5678",
  full_name: null,
  first_name: "Ana",
  last_name: null,
  phone: "+528112345678",
  birthday: "1990-01-01",
  sex: "female",
  deleted_at: null,
};

function deps(row: SigninRow | null = ROW): SigninDeps & { calls: string[]; logs: string[] } {
  const calls: string[] = [];
  const logs: string[] = [];
  return {
    calls,
    logs,
    stampRole: (role) => {
      calls.push(`stamp:${role}`);
      return Promise.resolve({ ok: true });
    },
    createRow: () => {
      calls.push("create");
      return Promise.resolve({ ok: true });
    },
    readRow: () => Promise.resolve({ ok: true, row }),
    syncPhone: (phone) => {
      calls.push(`sync:${phone}`);
      return Promise.resolve({ ok: true, row: { ...(row as SigninRow), phone } });
    },
    log: (line) => logs.push(line),
  };
}

const GOOGLE: SigninUser = {
  id: "u1",
  email: "ana@gmail.com",
  phone: null,
  appMetadata: { provider: "google", providers: ["google"] },
};

Deno.test("Auth's blank phone and email become null before any EF sees them", () => {
  const user = shapeAuthedUser({ id: "u1", email: "Ana@Gmail.com", phone: "", app_metadata: {} } as unknown as User);
  assertEquals(user.phone, null);
  assertEquals(user.emailLower, "ana@gmail.com");
  const phoneOnly = shapeAuthedUser({ id: "u2", email: "", phone: "528112345678", app_metadata: {} } as unknown as User);
  assertEquals(phoneOnly.email, null);
  assertEquals(phoneOnly.emailLower, null);
});

Deno.test("a Google session with no phone signs in, stamps consumer, never blanks the row's phone", async () => {
  const d = deps({ ...ROW, phone: null });
  const res = await handleSignin(GOOGLE, d);
  assertEquals(res.status, 200);
  assertEquals(res.body.role, "consumer");
  assertEquals(res.body.onboarded, true);
  assertEquals(d.calls, ["stamp:consumer", "create"]);
  assertEquals((res.body.consumer as SigninRow).phone, null);
  assertEquals("deleted_at" in (res.body.consumer as SigninRow), false);
});

Deno.test("a stored phone stays when the same guest comes back with Google", async () => {
  const d = deps(ROW);
  const res = await handleSignin({ ...GOOGLE, appMetadata: { ...GOOGLE.appMetadata, role: "consumer" } }, d);
  assertEquals(res.status, 200);
  assertEquals(d.calls, ["create"]);
  assertEquals((res.body.consumer as SigninRow).phone, ROW.phone);
});

Deno.test("a phone session syncs a drifted phone; the same phone writes nothing", async () => {
  const user: SigninUser = { id: "u1", email: null, phone: "+528199999999", appMetadata: { role: "consumer", providers: ["phone"] } };
  const d = deps(ROW);
  const res = await handleSignin(user, d);
  assertEquals(res.status, 200);
  assertEquals(d.calls, ["create", "sync:+528199999999"]);
  const same = deps(ROW);
  await handleSignin({ ...user, phone: ROW.phone }, same);
  assertEquals(same.calls, ["create"]);
});

Deno.test("an owner signing in on consumer keeps the business role", async () => {
  const d = deps(ROW);
  const res = await handleSignin({ ...GOOGLE, appMetadata: { role: "business", providers: ["google"] } }, d);
  assertEquals(res.body.role, "business");
  assertEquals(d.calls, ["create"]);
});

Deno.test("a session with neither phone nor email is a 400 and touches nothing", async () => {
  const d = deps();
  const res = await handleSignin({ id: "u1", email: null, phone: null, appMetadata: {} }, d);
  assertEquals(res.status, 400);
  assertEquals(d.calls, []);
});

Deno.test("a closed account answers 410 account_deleted", async () => {
  const res = await handleSignin(GOOGLE, deps({ ...ROW, deleted_at: "2026-11-01T00:00:00Z" }));
  assertEquals(res.status, 410);
  assertEquals(res.body.code, "account_deleted");
});

Deno.test("an unfinished profile is not onboarded", async () => {
  const res = await handleSignin(GOOGLE, deps({ ...ROW, birthday: null }));
  assertEquals(res.body.onboarded, false);
});

Deno.test("the sign-in log names the providers, never the email or phone", async () => {
  const d = deps();
  await handleSignin({ ...GOOGLE, phone: "+528112345678" }, d);
  assertEquals(d.logs, ["[consumer-web-signin-phone] user=u1 providers=google"]);
  assertEquals(providersOf({ provider: "phone" }), ["phone"]);
  assertEquals(providersOf(null), []);
});
