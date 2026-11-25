import { readEnv } from "@/lib/env";
import { EdgeError } from "@/lib/edge";
import { errorCopy } from "@/lib/error-copy";
import { pendingRequestId, settleRequest } from "@/lib/pending-request";
import { reconcile } from "@/lib/reconcile";
import { routePattern, scrub } from "@/lib/report";
import { secret } from "@/lib/storage";

test("a missing variable fails with its name", () => {
  const vars = { EXPO_PUBLIC_SUPABASE_URL: "u", EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "k" };
  expect(readEnv(vars)).toEqual({ supabaseUrl: "u", supabaseKey: "k", sentryDsn: null });
  for (const name of Object.keys(vars)) {
    expect(() => readEnv({ ...vars, [name]: " " })).toThrow(name);
  }
});

test("every profile that builds names the backend", () => {
  const { build } = jest.requireActual("../../eas.json");
  for (const name of ["development", "simulator", "preview", "production"]) {
    expect(() => readEnv(build[name].env)).not.toThrow();
  }
});

test("a pending request id is on the device, the same until its outcome", async () => {
  const first = await pendingRequestId("buy:p1");
  // The module holds nothing: what a restart finds is what the device holds.
  expect(await secret.get("mesita.request.buy:p1")).toBe(first);
  expect(await pendingRequestId("buy:p1")).toBe(first);
  expect(await pendingRequestId("buy:p2")).not.toBe(first);
  await settleRequest("buy:p1");
  expect(await pendingRequestId("buy:p1")).not.toBe(first);
});

test("a re-read is asked at most three times in ten seconds", async () => {
  const waits: number[] = [];
  const wait = async (ms: number) => void waits.push(ms);
  const never = jest.fn(async () => false);
  expect(await reconcile(never, wait)).toBe(false);
  expect(never).toHaveBeenCalledTimes(3);
  expect(waits.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(10_000);
  const second = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(true);
  expect(await reconcile(second, wait)).toBe(true);
  expect(second).toHaveBeenCalledTimes(2);
});

const edge = (kind: EdgeError["kind"], code: string, message: string) =>
  new EdgeError({ fn: "f", kind, retry: "safe", code, status: null, message, body: {}, requestId: "r1" });

test('an unreadable answer says "newer version" only when there is one', () => {
  const err = edge("unreadable", "unreadable_answer", "x");
  expect(errorCopy(err, true).message).toContain("newer version");
  expect(errorCopy(err, false).message).not.toContain("version");
  expect(errorCopy(edge("network", "network", "x"), false).offline).toBe(true);
  expect(errorCopy(new Error("secret detail"), false).message).not.toContain("secret");
});

test("a crash report carries nothing outside the allowlist", () => {
  const secrets = ["+525512345678", "Ana López", "eyJtoken", "gift_tok_9f", "join_tok_7a", "pi_1_secret_2", "QR-884422"];
  const [phone, name, token, gift, join, client, code] = secrets;
  const out = scrub({
    event_id: "e1",
    type: undefined,
    message: `failed for ${phone}`,
    user: { id: token, username: name, ip_address: "1.2.3.4" },
    request: { url: `https://mesita.ai/wallet/gift/${gift}`, headers: { Authorization: token } },
    extra: { client_secret: client },
    breadcrumbs: [{ message: `/pay/join/${join}` }],
    transaction: `/wallet/gift/${gift}`,
    tags: { fn: "consumer-web-get-wallet", status: "500", route: "/wallet/gift/[token]", guest: name, code: `x;${code}=` },
    contexts: { device: { model: "iPhone", name: `${name}'s iPhone` }, os: { name: "iOS", version: "19" }, state: { code } },
    exception: {
      values: [
        {
          type: "Error",
          value: `no gift ${gift} for ${phone}`,
          stacktrace: { frames: [{ filename: `app:///main.js?token=${token}`, function: "pay", lineno: 1, vars: { code } }] },
        },
      ],
    },
  } as never);
  const text = JSON.stringify(out);
  for (const secret of secrets) expect(text).not.toContain(secret);
  expect(out.tags).toEqual({ fn: "consumer-web-get-wallet", status: "500", route: "/wallet/gift/[token]" });
  expect(out.exception?.values?.[0]).toMatchObject({ type: "Error", value: "" });
  expect(routePattern(["wallet", "gift", "[token]"])).toBe("/wallet/gift/[token]");
});
