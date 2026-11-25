import kv from "expo-sqlite/kv-store";

import { secret } from "@/lib/storage";

const raw = (kv as unknown as { items: Map<string, string> }).items;

test("a secret reads back, and is not in the clear", async () => {
  await secret.set("s", "Ana +52 55 1234");
  expect(await secret.get("s")).toBe("Ana +52 55 1234");
  expect(raw.get("s")).not.toContain("Ana");
});

test("the same value is never stored the same way twice", async () => {
  await secret.set("s", "same");
  const first = raw.get("s");
  await secret.set("s", "same");
  expect(raw.get("s")).not.toBe(first);
});

test("a value that cannot be decrypted is no value", async () => {
  raw.set("s", "00".repeat(16) + ":abcdef");
  expect(await secret.get("s")).toBeNull();
  raw.set("s", "garbage");
  expect(await secret.get("s")).toBeNull();
});
