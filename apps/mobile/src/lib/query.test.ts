import { MutationObserver, onlineManager } from "@tanstack/react-query";
import kv from "expo-sqlite/kv-store";

import { EdgeError } from "@/lib/edge";
import { forgetReads, keepReads, queryClient, saveReads } from "@/lib/query";
import { secret } from "@/lib/storage";

const raw = (kv as unknown as { items: Map<string, string> }).items;
const NAME = "mesita.reads.g1";
const read = (key: string, value: string, persist = true) =>
  queryClient.fetchQuery({ queryKey: [key], queryFn: async () => value, meta: { persist } });

afterEach(async () => {
  onlineManager.setOnline(true);
  await forgetReads("g1");
  raw.clear();
});

test("only the allowlisted reads are kept, and they come back", async () => {
  await keepReads("g1");
  await read("mine", "Ana");
  await read("public", "list", false);
  await saveReads("g1");
  expect(raw.get(NAME)).toBeDefined();
  queryClient.clear();
  await forgetMemoryOnly();
  await keepReads("g1");
  expect(queryClient.getQueryData(["mine"])).toBe("Ana");
  expect(queryClient.getQueryData(["public"])).toBeUndefined();
});

/** A restart: what is in memory goes, what is on the device stays. */
async function forgetMemoryOnly() {
  const saved = raw.get(NAME);
  await forgetReads("g1");
  if (saved) raw.set(NAME, saved);
}

test("reads kept under another update or contract, or a day old, are dropped", async () => {
  const state = { mutations: [], queries: [] };
  for (const saved of [
    { version: "1:update-0", at: Date.now(), state },
    { version: "2:update-1", at: Date.now(), state },
    { version: "1:update-1", at: Date.now() - 25 * 3600_000, state },
  ]) {
    await secret.set(NAME, JSON.stringify(saved));
    await keepReads("g1");
    expect(raw.has(NAME)).toBe(false);
    await forgetReads(null);
  }
});

test("one guest's reads are never another's", async () => {
  await keepReads("g1");
  await read("mine", "Ana");
  await saveReads("g1");
  const saved = raw.get(NAME)!;
  await forgetReads(null);
  raw.set(NAME, saved);
  await keepReads("g2");
  expect(queryClient.getQueryData(["mine"])).toBeUndefined();
});

test("a read that resolves after sign-out leaves the cache empty", async () => {
  await keepReads("g1");
  let resolve!: (value: string) => void;
  const late = queryClient
    .fetchQuery({ queryKey: ["mine"], queryFn: () => new Promise<string>((done) => (resolve = done)), meta: { persist: true } })
    .catch(() => "cancelled");
  await Promise.resolve();
  await forgetReads("g1");
  resolve("Ana");
  expect(await late).toBe("cancelled");
  await saveReads("g1");
  expect(queryClient.getQueryCache().getAll()).toEqual([]);
  expect(raw.has(NAME)).toBe(false);
});

test("a mutation fired offline is sent at once, once, and nothing is replayed or saved", async () => {
  await keepReads("g1");
  onlineManager.setOnline(false);
  const sent = jest.fn(async () => {
    throw new Error("no connection");
  });
  await expect(new MutationObserver(queryClient, { mutationFn: sent }).mutate()).rejects.toThrow();
  expect(sent).toHaveBeenCalledTimes(1);
  onlineManager.setOnline(true);
  await queryClient.resumePausedMutations();
  expect(sent).toHaveBeenCalledTimes(1);
  await read("mine", "Ana");
  await saveReads("g1");
  const kept = JSON.parse((await secret.get(NAME))!);
  expect(kept.state.mutations).toEqual([]);
});

test("a read is asked again only when that is safe", () => {
  const retry = queryClient.getDefaultOptions().queries!.retry as (n: number, e: unknown) => boolean;
  const err = (how: EdgeError["retry"]) =>
    new EdgeError({ fn: "f", kind: "refusal", retry: how, code: "c", status: 1, message: "", body: {}, requestId: null });
  expect(retry(0, err("safe"))).toBe(true);
  expect(retry(2, err("safe"))).toBe(false);
  for (const how of ["after-fix", "reconcile-first", "never"] as const) expect(retry(0, err(how))).toBe(false);
});
