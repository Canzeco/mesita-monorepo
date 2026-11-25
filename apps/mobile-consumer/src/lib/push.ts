import { z } from "zod";

import { callEdge } from "@/lib/edge";
import { plain } from "@/lib/storage";

import { installId } from "./install";

const PENDING = "mesita.push.drop";
const none = z.object({}).passthrough();

/** Unregister this install while the session still exists. A failure keeps a
 *  one-install retry and does not stop sign-out. */
export async function dropPushInstall(): Promise<void> {
  const id = await installId();
  try {
    await callEdge("consumer-web-unregister-push", { install_id: id }, none, { mutation: true });
    await plain.remove(PENDING);
  } catch {
    await plain.set(PENDING, id);
  }
}

/** The retry for the install whose unregister failed. No other install. */
export async function retryDropPush(): Promise<void> {
  const pending = await plain.get(PENDING);
  if (!pending) return;
  try {
    await callEdge("consumer-web-unregister-push", { install_id: pending }, none, { mutation: true });
    await plain.remove(PENDING);
  } catch {
    // The local session is already gone or the call failed again. Try this install only, later.
  }
}

export async function registerPush(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) return;
  await callEdge(
    "consumer-web-register-push",
    { install_id: await installId(), token: trimmed },
    none,
    { mutation: true },
  );
}
