import kv from "expo-sqlite/kv-store";

import { callEdge, EdgeError } from "@/lib/edge";
import { keepReads, queryClient, saveReads } from "@/lib/query";
import { secret } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

import { SIGNED_OUT } from "./model";
import { deleteAccount, expire, hear, signOut, start, verifyCode } from "./session";
import { getSession, setSession } from "./store";
import { rememberTarget, settleTarget, takeTarget } from "./target";

jest.mock("@/lib/edge", () => ({ ...jest.requireActual("@/lib/edge"), callEdge: jest.fn() }));
const call = callEdge as jest.Mock;
const raw = (kv as unknown as { items: Map<string, string> }).items;
const KEPT = "mesita.reads.g1";

async function memberWithReads() {
  setSession({ ...SIGNED_OUT, settled: true, guestId: "g1" });
  await keepReads("g1");
  await queryClient.fetchQuery({ queryKey: ["mine"], queryFn: async () => "Ana", meta: { persist: true } });
  await saveReads("g1");
  await secret.set("mesita.session", JSON.stringify({ user: { id: "g1" } }));
  expect(raw.has(KEPT)).toBe(true);
}

function nothingLeft() {
  expect(raw.has(KEPT)).toBe(false);
  expect(queryClient.getQueryCache().getAll()).toEqual([]);
}

beforeEach(() => {
  call.mockReset();
  raw.clear();
  setSession(SIGNED_OUT);
  jest.spyOn(supabase.auth, "signOut").mockResolvedValue({ error: null });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("a failed push unregister still signs out and remembers this install", async () => {
  await memberWithReads();
  call.mockRejectedValueOnce(new Error("down"));
  await signOut();
  nothingLeft();
  expect(getSession().guestId).toBeNull();
  expect(call).toHaveBeenCalledWith(
    "consumer-web-unregister-push",
    expect.objectContaining({ install_id: expect.any(String) }),
    expect.anything(),
    { mutation: true },
  );
  expect(raw.get("mesita.push.drop")).toEqual(expect.any(String));
});

test("sign-out leaves nothing of the guest on the device", async () => {
  await memberWithReads();
  rememberTarget("/me");
  await signOut();
  nothingLeft();
  expect(await secret.get("mesita.session")).toBeNull();
  expect(getSession()).toMatchObject({ guestId: null, notice: null });
  expect(takeTarget("open", true)).toBeNull();
});

test("deleting the account does too; a refused deletion keeps everything", async () => {
  await memberWithReads();
  call.mockRejectedValueOnce(new Error("no"));
  await expect(deleteAccount()).rejects.toThrow("no");
  expect(getSession().guestId).toBe("g1");
  expect(raw.has(KEPT)).toBe(true);
  call.mockResolvedValueOnce({});
  await deleteAccount();
  nothingLeft();
});

test("a suspension empties the reads and says the server's sentence", async () => {
  await memberWithReads();
  hear({ code: "suspended", message: "Write to us." });
  await new Promise((done) => setTimeout(done, 20));
  nothingLeft();
  expect(getSession()).toMatchObject({ guestId: "g1", suspended: "Write to us." });
});

test("an expired session drops the session and the reads, says why, and keeps the target", async () => {
  await memberWithReads();
  settleTarget(false);
  rememberTarget("/me?when=past");
  await expire();
  nothingLeft();
  expect(getSession()).toMatchObject({ guestId: null, notice: "You were signed out. Sign in again." });
  expect(takeTarget("open", true)).toBe("/me?when=past");
});

test("a dead session heard twice, or by a visitor, is heard once", async () => {
  await memberWithReads();
  hear({ code: "session" });
  hear({ code: "session" });
  await new Promise((done) => setTimeout(done, 20));
  expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});

test("update_app moves the gate and touches nothing else", async () => {
  await memberWithReads();
  hear({ code: "update_app" });
  expect(getSession()).toMatchObject({ updateRequired: true, guestId: "g1" });
  expect(raw.has(KEPT)).toBe(true);
});

test("starting reads the device and no network", async () => {
  await secret.set("mesita.session", JSON.stringify({ user: { id: "g1" } }));
  await start();
  expect(getSession()).toMatchObject({ settled: true, guestId: "g1" });
  expect(call).not.toHaveBeenCalled();
});

test("a storage that does not answer opens as a visitor in five seconds, and a late session is adopted", async () => {
  jest.useFakeTimers();
  let answer!: (v: string) => void;
  jest.spyOn(secret, "get").mockImplementationOnce(() => new Promise((done) => (answer = done)));
  const started = start();
  await jest.advanceTimersByTimeAsync(5000);
  expect(getSession()).toMatchObject({ settled: true, guestId: null });
  answer(JSON.stringify({ user: { id: "g1" } }));
  await started;
  expect(getSession().guestId).toBe("g1");
});

test("a right code signs in even when the second step fails, and asks for no onboarding on a failed read", async () => {
  jest.spyOn(supabase.auth, "verifyOtp").mockResolvedValue({ data: { user: { id: "g1" }, session: null }, error: null } as never);
  call.mockRejectedValueOnce(
    new EdgeError({ fn: "f", kind: "network", retry: "safe", code: "network", status: null, message: "", body: {}, requestId: null }),
  );
  expect(await verifyCode("+52", "123456")).toBeNull();
  expect(getSession()).toMatchObject({ guestId: "g1", onboarded: true });
  call.mockResolvedValueOnce({ onboarded: false });
  await verifyCode("+52", "123456");
  expect(getSession().onboarded).toBe(false);
});
