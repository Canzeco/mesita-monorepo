import * as Updates from "expo-updates";
import { AppState } from "react-native";

import { report } from "@/lib/report";

// A published update is found at launch by expo-updates and, here, whenever
// the app comes back to the front. A downloaded one is applied on the next
// cold start, or on a return after half an hour away with no task open: never
// in the middle of one. A crashed update is never applied again from here.

export const AWAY_MS = 30 * 60 * 1000;

export function shouldApply(awayMs: number, pending: boolean, taskOpen: boolean): boolean {
  return pending && !taskOpen && awayMs >= AWAY_MS;
}

let leftAt: number | null = null;
let pending = false;

/** Called when the app comes back. */
export async function onReturn(now: number, taskOpen: boolean): Promise<void> {
  if (!Updates.isEnabled || Updates.isEmergencyLaunch) return;
  const awayMs = leftAt === null ? 0 : now - leftAt;
  leftAt = null;
  try {
    if (shouldApply(awayMs, pending, taskOpen)) return await Updates.reloadAsync();
    if (pending) return;
    if (!(await Updates.checkForUpdateAsync()).isAvailable) return;
    await Updates.fetchUpdateAsync();
    pending = true;
    if (shouldApply(awayMs, pending, taskOpen)) await Updates.reloadAsync();
  } catch (err) {
    // No network, or the service is down: the next return asks again.
    report(err, { name: "update_check" });
  }
}

export function onLeave(now: number): void {
  leftAt ??= now;
}

/** `taskOpen` says whether a screen covers the tabs right now. */
export function followUpdates(taskOpen: () => boolean): () => void {
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "background") onLeave(Date.now());
    else if (state === "active") void onReturn(Date.now(), taskOpen());
  });
  return () => sub.remove();
}
