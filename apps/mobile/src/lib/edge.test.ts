import { fetch } from "expo/fetch";
import { z } from "zod";

import { callEdge, EdgeError, oneOf, onRefusal, type Refusal } from "@/lib/edge";
import * as auth from "@/lib/supabase";

const send = fetch as unknown as jest.Mock;
const schema = z.object({ id: z.string() });
const FN = "consumer-web-get-x";

const answer = (status: number, body: unknown, id: string | null = "req-1") => ({
  status,
  text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  headers: { get: (name: string) => (name === "sb-request-id" ? id : null) },
});

const heard: Refusal[] = [];
let stop: () => void;

beforeEach(() => {
  send.mockReset();
  heard.length = 0;
  stop = onRefusal((r) => void heard.push(r));
  jest.spyOn(auth, "currentToken").mockResolvedValue({ kind: "member", token: "t1" });
  jest.spyOn(auth, "refreshToken").mockResolvedValue({ kind: "member", token: "t2" });
});
afterEach(() => {
  stop();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const failure = async (opts = {}): Promise<EdgeError> => {
  try {
    await callEdge(FN, {}, schema, opts);
  } catch (err) {
    return err as EdgeError;
  }
  throw new Error("expected a failure");
};

test("sends the contract, the region and the guest's token", async () => {
  send.mockResolvedValue(answer(200, { ok: true, id: "1", extra: "ignored" }));
  expect(await callEdge(FN, { a: 1 }, schema)).toEqual({ id: "1" });
  const [url, init] = send.mock.calls[0];
  expect(url).toBe(`https://stub.supabase.co/functions/v1/${FN}?forceFunctionRegion=us-west-2`);
  expect(init.headers).toMatchObject({ apikey: "public-key", Authorization: "Bearer t1", "x-mesita-contract": "1" });
});

test("a visitor calls with the public key", async () => {
  jest.spyOn(auth, "currentToken").mockResolvedValue({ kind: "anonymous" });
  send.mockResolvedValue(answer(200, { ok: true, id: "1" }));
  await callEdge(FN, {}, schema);
  expect(send.mock.calls[0][1].headers.Authorization).toBe("Bearer public-key");
});

test("a member whose token cannot be refreshed is never sent as a visitor", async () => {
  jest.spyOn(auth, "currentToken").mockResolvedValue({ kind: "unreachable" });
  expect(await failure({ mutation: true })).toMatchObject({ kind: "network", code: "network", retry: "safe" });
  expect(send).not.toHaveBeenCalled();
});

test("a refusal carries the server's code, sentence, fields and request id", async () => {
  send.mockResolvedValue(answer(409, { ok: false, code: "too_many", error: "Too many.", max: 3 }));
  expect(await failure()).toMatchObject({
    fn: FN,
    kind: "refusal",
    retry: "after-fix",
    code: "too_many",
    status: 409,
    message: "Too many.",
    body: { max: 3 },
    requestId: "req-1",
  });
  expect(heard).toEqual([]);
});

test("a lost answer is safe for a read and reconcile-first for a mutation", async () => {
  send.mockRejectedValue(new TypeError("Network request failed"));
  expect(await failure()).toMatchObject({ kind: "network", code: "network", retry: "safe" });
  expect(await failure({ mutation: true })).toMatchObject({ kind: "network", retry: "reconcile-first" });
});

test.each([
  [false, 15_000],
  [true, 30_000],
])("gives up (mutation %s) after %d ms", async (mutation, ms) => {
  jest.useFakeTimers();
  send.mockImplementation(
    (_url, { signal }) =>
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))),
  );
  const failed = failure({ mutation });
  await jest.advanceTimersByTimeAsync(ms - 1);
  expect(send.mock.calls[0][1].signal.aborted).toBe(false);
  await jest.advanceTimersByTimeAsync(1);
  expect(await failed).toMatchObject({ code: "timeout", retry: mutation ? "reconcile-first" : "safe" });
});

test("the caller's own cancel is not a network failure", async () => {
  const abort = new AbortController();
  send.mockImplementation(
    (_url, { signal }) =>
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))),
  );
  const call = callEdge(FN, {}, schema, { signal: abort.signal });
  await Promise.resolve();
  abort.abort();
  await expect(call).rejects.toThrow("aborted");
  await expect(call).rejects.not.toBeInstanceOf(EdgeError);
});

test("a non-JSON 502 is the server's: reconcile-first for a mutation", async () => {
  send.mockResolvedValue(answer(502, "<html>Bad gateway</html>"));
  expect(await failure()).toMatchObject({ kind: "server", code: "http_502", retry: "safe" });
  expect(await failure({ mutation: true })).toMatchObject({ kind: "server", retry: "reconcile-first" });
});

test("an unreadable answer names the keys and never the values", async () => {
  send.mockResolvedValue(answer(200, { ok: true, id: 55512345 }));
  const err = await failure({ mutation: true });
  expect(err).toMatchObject({ kind: "unreadable", code: "unreadable_answer", retry: "reconcile-first" });
  expect(err.body).toEqual({ keys: ["id"] });
  expect(JSON.stringify(err) + err.message).not.toContain("55512345");
  // A mutation whose answer cannot be read was sent exactly once.
  expect(send).toHaveBeenCalledTimes(1);
});

test("a 200 that is not the envelope is unreadable", async () => {
  send.mockResolvedValue(answer(200, "hello"));
  expect(await failure()).toMatchObject({ kind: "unreadable" });
});

test("tolerant readers: an unknown list value reads unknown", () => {
  const status = z.object({ status: oneOf("open", "paid") });
  expect(status.parse({ status: "paid", newer: 1 })).toEqual({ status: "paid" });
  expect(status.parse({ status: "split" })).toEqual({ status: "unknown" });
});

test("only update_app and suspended move the gate", async () => {
  send.mockResolvedValue(
    answer(426, { ok: false, code: "update_app", error: "Update.", min_contract: 5, seen_contract: 1 }),
  );
  expect(await failure()).toMatchObject({ retry: "never", body: { min_contract: 5, seen_contract: 1 } });
  send.mockResolvedValue(answer(403, { ok: false, code: "suspended", error: "Write to us." }));
  await failure();
  for (const code of ["test_guest", "too_many", "account_deleted"]) {
    send.mockResolvedValue(answer(403, { ok: false, code, error: "No." }));
    await failure();
  }
  send.mockResolvedValue(answer(500, { ok: false, error: "Internal error" }));
  await failure();
  expect(heard).toEqual([{ code: "update_app" }, { code: "suspended", message: "Write to us." }]);
});

const GATEWAY = { code: "UNAUTHORIZED_INVALID_JWT", message: "Invalid JWT" };

test("a gateway 401 gets one refresh and one retry with the new token", async () => {
  send.mockResolvedValueOnce(answer(401, GATEWAY)).mockResolvedValueOnce(answer(200, { ok: true, id: "1" }));
  expect(await callEdge(FN, {}, schema, { mutation: true })).toEqual({ id: "1" });
  expect(send.mock.calls.map(([, init]) => init.headers.Authorization)).toEqual(["Bearer t1", "Bearer t2"]);
  expect(heard).toEqual([]);
});

test("a gateway 401 after a good refresh refuses, and signs nobody out", async () => {
  send.mockResolvedValue(answer(401, GATEWAY));
  expect(await failure()).toMatchObject({ kind: "refusal", code: "http_401" });
  expect(send).toHaveBeenCalledTimes(2);
  expect(heard).toEqual([]);
});

test.each(["sign_in", "session_invalid"])("a coded 401 %s after a good refresh ends the session", async (code) => {
  send.mockResolvedValue(answer(401, { ok: false, code, error: "Sign in." }));
  expect(await failure()).toMatchObject({ code });
  expect(heard).toEqual([{ code: "session" }]);
});

test("a refresh Auth refuses ends the session; one the network lost does not", async () => {
  send.mockResolvedValue(answer(401, { ok: false, error: "Invalid session" }));
  jest.spyOn(auth, "refreshToken").mockResolvedValue({ kind: "unreachable" });
  expect(await failure({ mutation: true })).toMatchObject({ kind: "network", retry: "safe" });
  expect(heard).toEqual([]);
  jest.spyOn(auth, "refreshToken").mockResolvedValue({ kind: "anonymous" });
  await failure();
  expect(heard).toEqual([{ code: "session" }]);
});

test("a visitor's 401 refreshes nothing and ends nothing", async () => {
  jest.spyOn(auth, "currentToken").mockResolvedValue({ kind: "anonymous" });
  send.mockResolvedValue(answer(401, { ok: false, code: "sign_in", error: "Sign in." }));
  await failure();
  expect(auth.refreshToken).not.toHaveBeenCalled();
  expect(heard).toEqual([]);
});
