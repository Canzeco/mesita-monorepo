import * as Crypto from "expo-crypto";

import { secret } from "@/lib/storage";

// A mutation the backend can recognise as a repeat carries a request id. It
// is minted once per attempt the guest started and kept until the outcome is
// known, so an app killed mid-payment comes back with the same id. Each
// feature's api.ts states its function's rule.

const nameFor = (attempt: string) => `mesita.request.${attempt}`;

/** The id of this attempt: the one already waiting, or a new one. */
export async function pendingRequestId(attempt: string): Promise<string> {
  const waiting = await secret.get(nameFor(attempt));
  if (waiting) return waiting;
  const made = Crypto.randomUUID();
  await secret.set(nameFor(attempt), made);
  return made;
}

/** The outcome is known, whatever it was. */
export function settleRequest(attempt: string): Promise<unknown> {
  return Promise.resolve(secret.remove(nameFor(attempt)));
}
