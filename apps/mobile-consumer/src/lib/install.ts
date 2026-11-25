import * as Crypto from "expo-crypto";

import { plain } from "@/lib/storage";

const KEY = "mesita.install";

/** Stable id for this install. It survives sign-out so a failed unregister can be retried. */
export async function installId(): Promise<string> {
  const existing = await plain.get(KEY);
  if (existing) return existing;
  const made = Crypto.randomUUID();
  await plain.set(KEY, made);
  return made;
}
